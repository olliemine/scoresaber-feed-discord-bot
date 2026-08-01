import { UserFeedUpdater } from "../feed/userFeed.js";
import { localizationFunction } from "../languages/lang.js";
import { SearchObject, idSearch } from "../scoresaber/handlers/getScoreSaberPlayer.js";
import { user } from "../types/db.js";
import { userRefresh } from "./userRefresh.js";
import userSchema from "../models/userSchema.js"
import { UPDATE_RESULT, UPDATE_STATUS } from "../types/util.js";
import TextChanges from "../classes/textChanges.js";
import { promiseRaceAll } from "../misc/util.js";
import { UPDATE_STATUS_LANGUAGE } from "./updateStatus.js";
import { DEBUG_LEVELS, logger } from "../logger.js";
import { AnyScoreSaberUserBody, ScoreSaberUserBodyFull } from "../types/scoresaber.js";
import { getUserCountry, isFromMainCountry } from "../discord/account/userFunctions.js";
import { getRank, matchMainCountriesUsers } from "../db/filteredUsers.js";

async function refreshAndPersist(
	dataUser: user,
	scoresaberUser: AnyScoreSaberUserBody,
	localization: localizationFunction
) {
	const profileSync = await userRefresh(dataUser, scoresaberUser, localization)

	if(profileSync.changes) {
		await userSchema.updateOne({ "scoresaberID": dataUser.scoresaberID }, profileSync.changes)
	}

	return profileSync
}

export class UserUpdater {
	static async single(user: user, localization: localizationFunction): Promise<UPDATE_RESULT> {
		const scoresaberUserRes = await idSearch(user.scoresaberID, false)
		const changes = new TextChanges(localization)

		if(!scoresaberUserRes.status) return {
			result: UPDATE_STATUS.ERROR,
			status: changes.addText(scoresaberUserRes.body, 1)
		}

		let debugMessage: TextChanges
		let updatedUser: user
		let profileHadChanges = false

		try {
			const profileSync = await refreshAndPersist(user, scoresaberUserRes.body, localization)
			
			debugMessage = profileSync.debugMessage
			updatedUser = profileSync.newUser
			profileHadChanges = !!profileSync.changes
		} catch(err) {
			logger.unknownError(err)
			
			return {
				result: UPDATE_STATUS.ERROR,
				status: err instanceof Error ? changes.addText(err.message, 1) : changes.addText(localization("unexpectedError"), 1)
			}
		}

		try {
			const feedRes = await UserFeedUpdater.single(updatedUser)
			
			changes.addLineBreak()

			if(feedRes.status) changes.combine(feedRes.status)
			else changes.addText(`Feed: ${localization(UPDATE_STATUS_LANGUAGE[feedRes.result])}`, 1)

			if(!profileHadChanges && feedRes.result === UPDATE_STATUS.NO_UPDATE) {
				return {
					result: UPDATE_STATUS.NO_UPDATE,
					status: debugMessage
				}
			}
		} catch(err) {
			logger.unknownError(err)

			changes.combine(debugMessage)

			return {
				result: UPDATE_STATUS.PARTIAL_SUCCESS,
				status: changes.addText(
					`${localization("userPlayerUpdateFeedError")}: ${err instanceof Error ? err.message : localization("unexpectedError")}`
					, 1
				) 
			}
		}

		return {
			result: UPDATE_STATUS.SUCCESS,
			status: debugMessage
		}
	}

	static async multi(dataUsers: user[], localization: localizationFunction): Promise<UPDATE_RESULT> {
		if(!dataUsers.length) return {
			result: UPDATE_STATUS.NO_UPDATE
		}
		
		const scoresaberUsersRes = await 
			promiseRaceAll<false, SearchObject<false, ScoreSaberUserBodyFull>>(dataUsers.map(user => idSearch(user.scoresaberID, false)), 1000*60*10, false)
		const changesCombination: TextChanges[] = []
		const feedUsers: user[] = []

		try {
			for await(const [index, scoresaberUserRes] of scoresaberUsersRes.entries()) {
				const user = dataUsers[index]
				const changes = new TextChanges()

				const changesIndex = changesCombination.push(changes) - 1

				if(scoresaberUserRes === false || scoresaberUserRes.status === false) {
					changesCombination[changesIndex]
						.addText(`${user.scoresaberName} error: ${scoresaberUserRes === false ? "unknown" : scoresaberUserRes.status}`, 0)
						.addLineBreak()
					
					continue
				}
				
				const { changes: profileChanges, debugMessage, newUser } = await refreshAndPersist(user, scoresaberUserRes.body, localization)

				changesCombination[changesIndex].combine(debugMessage)

				if(!profileChanges) {
					changesCombination[changesIndex]
						.addText(localization(UPDATE_STATUS_LANGUAGE[UPDATE_STATUS.NO_UPDATE]), 1)
				}

				changesCombination[changesIndex].addLineBreak()
				feedUsers.push(newUser)
			}

			// Recompute region ranks after all PP flushes so batch order can't desync mainCountriesRank
			for(const feedUser of feedUsers) {
				if(!isFromMainCountry(getUserCountry(feedUser))) continue

				const regionRank = await getRank(feedUser, "scoresaberLastPP.value", false, "descending", matchMainCountriesUsers())
				if(regionRank === null || (feedUser.mainCountriesRank?.value ?? 0) === regionRank) continue

				feedUser.mainCountriesRank = {
					...(feedUser.mainCountriesRank ?? { lastFeed: 0, lastFeedDate: new Date() }),
					value: regionRank
				}
				await userSchema.updateOne(
					{ scoresaberID: feedUser.scoresaberID },
					{ "mainCountriesRank.value": regionRank }
				)
			}
		} catch(err) {
			logger.unknownError(err)
				
			return {
				result: UPDATE_STATUS.ERROR,
				status: err instanceof Error ? new TextChanges().addText(err.message, 1) : new TextChanges().addText(localization("unexpectedError"), 1)
			}
		}

		logger.debug(`UserUpdater.multi: updating feeds for ${feedUsers.length} user(s)`, DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)

		const feedRes = await UserFeedUpdater.multi(feedUsers)
		if(feedRes.result === UPDATE_STATUS.ERROR) return feedRes

		return {
			result: UPDATE_STATUS.SUCCESS,
			status: new TextChanges().combine(...changesCombination)
		}
	}
}
