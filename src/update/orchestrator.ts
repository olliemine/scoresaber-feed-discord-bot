import TextChanges from "../classes/textChanges.js"
import { isSaved, shouldAccountExist } from "../discord/account/userFunctions.js"
import getLanguage from "../languages/lang.js"
import { user } from "../types/db.js"
import { PromiseOrNot, UPDATE_RESULT, UPDATE_STATUS } from "../types/util.js"
import { LevelUpdater } from "./levelUpdate.js"
import { UserUpdater } from "./userUpdate.js"
import userSchema from "../models/userSchema.js"
import levelSchema from "../models/levelSchema.js"
import createUser from "../db/createUser.js"
import appContext from "../index.js"
import { idSearch } from "../scoresaber/handlers/getScoreSaberPlayer.js"
import SentMessageHandler, { DiscordVariables } from "../classes/sentMessageHandler.js"
import { UPDATE_STATUS_LANGUAGE } from "./updateStatus.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { unexpectedErrorInteractionHandler } from "../discord/message/interactions.js"

let pendingUpdateLock: Promise<void> = Promise.resolve()

async function withUpdateLock<T>(operation: () => Promise<T>): Promise<T> {
	const previous = pendingUpdateLock
	let releaseLock!: () => void
	pendingUpdateLock = new Promise<void>((resolve) => { releaseLock = resolve })

	await previous

	try {
		return await operation()
	} finally {
		releaseLock()
	}
}

async function deleteUserFromLevels(scoresaberID: string) {
	return await levelSchema.bulkWrite([{
		updateMany: {
			filter: {},
			update: {
				$pull: {
					leaderboard: {
						"playerID": scoresaberID
					}
				}
			}
		}
	}, {
		deleteMany: {
			filter: {
				leaderboard: {
					$size: 0
				}
			}
		}
	}])
}

async function handleSaveStatus(dataUser: user): Promise<{
	updateUser: boolean,
	updateLevelsUser: boolean,
	appliedChanges: boolean,
	newUser?: user
}> {
	if(!shouldAccountExist(dataUser)) {
		await userSchema.deleteOne({ scoresaberID: dataUser.scoresaberID })
		await deleteUserFromLevels(dataUser.scoresaberID)

		return {
			updateUser: false,
			updateLevelsUser: false,
			appliedChanges: true
		}
	}

	if(!isSaved(dataUser) && dataUser.scoresaberLastMap) {
		await userSchema.deleteOne({ scoresaberID: dataUser.scoresaberID })
		
		const scoresaberUser = await idSearch(dataUser.scoresaberID, false)

		if(!scoresaberUser.status) throw new Error(scoresaberUser.body)

		const discordUser = (dataUser.discordID && dataUser.discordIsInServer && appContext.server) ?
			appContext.server.members.cache.get(dataUser.discordID)?.user :
			undefined

		const newUser = createUser(scoresaberUser.body, dataUser.category, discordUser)

		await deleteUserFromLevels(dataUser.scoresaberID)
		await userSchema.create(newUser)

		return {
			updateUser: true,
			updateLevelsUser: false,
			appliedChanges: true,
			newUser: newUser
		}
	}

	return {
		updateUser: true,
		updateLevelsUser: isSaved(dataUser),
		appliedChanges: false
	}
}

function combineUpdateResults(userUpdateRes: UPDATE_RESULT, levelUpdateRes: UPDATE_RESULT, omitEmptyStatus = false): UPDATE_RESULT {
	const changes = new TextChanges()

	if(userUpdateRes.status) changes.combine(userUpdateRes.status)
	if(levelUpdateRes.status) changes.combine(levelUpdateRes.status)

	return {
		result: Math.max(userUpdateRes.result, levelUpdateRes.result),
		status: omitEmptyStatus && changes.textCount === 0 ? undefined : changes
	}
}

interface UserUpdateHandler {
	userNoUpdate(appliedChanges: boolean): PromiseOrNot<void>
	userUpdate(res: UPDATE_RESULT): PromiseOrNot<void>
	levelUpdate(res: UPDATE_RESULT): PromiseOrNot<void>
	startingLevelUpdate(): PromiseOrNot<void>
	unexpectedError(err: unknown): PromiseOrNot<void>
}

export class InteractionUserUpdateHandler implements UserUpdateHandler {
	public sentMessage: SentMessageHandler

	constructor(sentMessage: SentMessageHandler) {
		this.sentMessage = sentMessage
	}

	async userNoUpdate(appliedChanges: boolean) {
		const updateStatus = appliedChanges ? UPDATE_STATUS.SUCCESS : UPDATE_STATUS.NO_UPDATE
		await this.sentMessage.normal({
			title: this.sentMessage.getLocalization(UPDATE_STATUS_LANGUAGE[updateStatus]),
			color: DiscordVariables.UPDATE_STATUS_COLOR_TABLE[updateStatus]
		})
	}

	private async updateMessage(res: UPDATE_RESULT) {
		await this.sentMessage.normal({
			description: res.status?.getText(),
			color: DiscordVariables.UPDATE_STATUS_COLOR_TABLE[res.result],
			title: this.sentMessage.getLocalization(UPDATE_STATUS_LANGUAGE[res.result])
		})
	}

	userUpdate = this.updateMessage

	levelUpdate = this.updateMessage

	async startingLevelUpdate() {
		await this.sentMessage.nextEmbed().localesLoading("gettingPlays")
	}

	unexpectedError(err: unknown): void {
		unexpectedErrorInteractionHandler(err, this.sentMessage)
	}
}

export class UpdateOrchestrator {
	/**
	 * Warning: User need to be in object form
	 */
	static async runSingle(
		user: user,
		localization = getLanguage.getDefault,
		updatesHandler?: UserUpdateHandler
	): Promise<UPDATE_RESULT> {
		return withUpdateLock(async () => {
			try {
				const { updateUser, updateLevelsUser, appliedChanges, newUser } = await handleSaveStatus(user)
				
				if(!updateUser) {
					if(updatesHandler) updatesHandler.userNoUpdate(appliedChanges)
					return {
						result: appliedChanges ? UPDATE_STATUS.SUCCESS : UPDATE_STATUS.NO_UPDATE
					}
				}
			
				if(newUser) user = newUser
			
				const userUpdateRes = await UserUpdater.single(user, localization)
			
				if(updatesHandler) updatesHandler.userUpdate(userUpdateRes)

				if(userUpdateRes.result === UPDATE_STATUS.ERROR || !updateLevelsUser) return userUpdateRes
			
				if(updatesHandler) updatesHandler.startingLevelUpdate()

				const levelUserUpdateRes = await LevelUpdater.single(user)
			
				if(updatesHandler) updatesHandler.levelUpdate(levelUserUpdateRes)

				return combineUpdateResults(userUpdateRes, levelUserUpdateRes)
			} catch(err) {
				logger.unknownError(err)
				if(updatesHandler) updatesHandler.unexpectedError(err)
					
				return {
					result: UPDATE_STATUS.ERROR
				}		
			}
		})
	}

	/**
	 * Warning: Users need to be in object form
	 * @param options.skipLevelUpdate Skip play history sync (e.g. websocket already saved the new plays)
	 */
	static async runMulti(
		users: user[],
		localization = getLanguage.getDefault,
		options?: { skipLevelUpdate?: boolean }
	): Promise<UPDATE_RESULT> {
		return withUpdateLock(async () => {
			try {
				let updateUsers: user[] = []
				let levelUsers: user[] = []
			
				for(const user of users) {
					const { updateUser, updateLevelsUser, newUser } = await handleSaveStatus(user)
			
					if(updateUser) updateUsers.push(newUser ?? user)
					
					if(updateLevelsUser && !options?.skipLevelUpdate) levelUsers.push(newUser ?? user)
				}

				logger.debug(`Users getting updated: ${updateUsers.length}, users getting plays updated: ${levelUsers.length}`, DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
			
				const userUpdateRes = await UserUpdater.multi(updateUsers, localization)
			
				if(userUpdateRes.result === UPDATE_STATUS.ERROR) return userUpdateRes

				if(options?.skipLevelUpdate || levelUsers.length === 0) {
					logger.debug("Profile update finished, skipping level update.", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
					return userUpdateRes
				}

				logger.debug("Profile update finished, starting level update...", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)

				const levelUserUpdateRes = await LevelUpdater.multi(levelUsers)

				logger.debug("Level update finished.", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
			
				return combineUpdateResults(userUpdateRes, levelUserUpdateRes, true)
			} catch(err) {
				logger.unknownError(err)

				return {
					result: UPDATE_STATUS.ERROR
				}		
			}
		})
	}
}
