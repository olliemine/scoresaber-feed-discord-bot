import TakeTime from "../classes/takeTime.js"
import { getCodesOfMissingCodeMaps } from "../external/beatsaver.js"
import { getNotSavedPlays } from "../scoresaber/levels/getPlays.js"
import { user } from "../types/db.js"
import { UPDATE_RESULT, UPDATE_STATUS } from "../types/util.js"
import { levelRefreshDebugData } from "./levelRefresh.js"
import { promiseRaceAll } from "../misc/util.js"
import { getTotalScores } from "../scoresaber/player/playerFunctions.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import TextChanges from "../classes/textChanges.js"
import getLanguage from "../languages/lang.js"
import levelQueue from "./levelQueue.js"
import { ExtractQueueFunctionParams } from "../classes/queue.js"
import levelUpdateCounters from "./levelUpdateCounters.js"
import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js"
import userSchema from "../models/userSchema.js"

function playsFetchError(err: unknown): UPDATE_RESULT {
	return {
		result: UPDATE_STATUS.ERROR,
		status: err instanceof Error ? new TextChanges().addText(err.message) : new TextChanges().addText(getLanguage.getDefault("unexpectedError"))
	}
}

/** Preserve singular (codes → counters) vs multi (counters → codes) order. */
async function afterPlaysPosted(time: TakeTime, order: "single" | "multi") {
	if(order === "single") {
		await time.start("Get Beatsaver Codes", getCodesOfMissingCodeMaps)
		await time.start("Update top 1 count", levelUpdateCounters)
		return
	}

	await time.start("Update top 1 count", levelUpdateCounters)
	await time.start("Get Beatsaver Codes", getCodesOfMissingCodeMaps)
}

export class LevelUpdater {
	static async single(dataUser: user): Promise<UPDATE_RESULT> {
		const time = new TakeTime("Times:")
		let scores: ScoreSaberPlay[]
		
		time.start("Total")
		
		time.start("Get Plays")
		
		try {
			scores = await getNotSavedPlays(dataUser)
		} catch(err) {
			logger.unknownError(err)
			return playsFetchError(err)
		}
		
		time.endTime("Get Plays")
		
		if(scores.length === 0) return {
			result: UPDATE_STATUS.NO_UPDATE
		}
		
		time.start("Post Maps")
		
		const res = await levelQueue.getElement([dataUser, scores], true)

		if(!res) return {
			result: UPDATE_STATUS.NO_UPDATE
		}

		time.endTime("Post Maps")
		
		await afterPlaysPosted(time, "single")
		
		time.endTime("Total")

		time.addLineBreak()
			.addText("Stats:", 0)
			.addText(`NewMaps: ${res.debugData.newMaps}`, 1)
			.addText(`NewPlays: ${res.debugData.newPlays}`, 1)
			.addText(`Average Time Per Request: ${res.debugData.getAverage.toFixed(2)}s`, 1)

		return {
			result: UPDATE_STATUS.SUCCESS,
			status: time
		}
	}

	static async multi(dataUsers: user[]): Promise<UPDATE_RESULT> {
		if(!dataUsers.length) return {
			result: UPDATE_STATUS.NO_UPDATE
		}
		
		const time = new TakeTime()
		
		time.start("Total")
		time.start("Get Plays")
		
		logger.debug(`LevelUpdater.multi: checking play counts for ${dataUsers.length} user(s)`, DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)

		// Prefer DB counts over possibly-stale in-memory users (e.g. after WS counter refresh)
		const freshUsers = await userSchema.find({
			scoresaberID: { $in: dataUsers.map(u => u.scoresaberID) }
		}).lean()
		const freshCountById = new Map(freshUsers.map(u => [u.scoresaberID, u.totalPlayedCount ?? 0]))

		const totalPlayCounts = await promiseRaceAll<false, number | false>(dataUsers.map(user => getTotalScores(user.scoresaberID)), 1000*60*3, false)

		const dataUserToTotalPlayCount: {[key: string]: number} = {}

		let dataUsersToBeUpdated: user[] = []

		for (let index = 0; index < totalPlayCounts.length; index++) {
			const value = totalPlayCounts[index]
			const dataUser = dataUsers[index]
			const dbCount = freshCountById.get(dataUser.scoresaberID) ?? dataUser.totalPlayedCount ?? 0
			dataUser.totalPlayedCount = dbCount

			if(value === false) {
				logger.debug(
					`LevelUpdater.multi: skipping ${dataUser.scoresaberName}, could not resolve API play count`,
					DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
				)
				continue
			}

			if(value === dbCount) {
				logger.debug(
					`LevelUpdater.multi: skipping ${dataUser.scoresaberName}, play count unchanged (${value})`,
					DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
				)
				continue
			}

			logger.debug(
				`LevelUpdater.multi: ${dataUser.scoresaberName} needs update (db=${dbCount}, api=${value})`,
				DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
			)

			dataUserToTotalPlayCount[dataUser.scoresaberID] = value
			dataUsersToBeUpdated.push(dataUser)
		}

		let scores: (false | ScoreSaberPlay[])[] = []

		logger.debug(
			`LevelUpdater.multi: ${dataUsersToBeUpdated.length} user(s) queued for play fetch`,
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)

		if(dataUsersToBeUpdated.length > 0) {
			levelQueue.stopQueue()

			try {
				for await(const dataUser of dataUsersToBeUpdated) {
					const dataUserScores = await getNotSavedPlays(dataUser, dataUserToTotalPlayCount[dataUser.scoresaberID])
					scores.push(dataUserScores)
				}
			} catch(err) {
				logger.unknownError(err)
				return playsFetchError(err)
			} finally {
				levelQueue.continueQueue()
			}
		}

		time.endTime("Get Plays")

		time.start("Post Maps")
		
		let elements: ExtractQueueFunctionParams<typeof levelQueue>[] = []

		for(const [index, score] of scores.entries()) {
			if(score === false || score.length === 0) continue
			
			elements.push([dataUsersToBeUpdated[index], score])
		}
		
		const results = await levelQueue.getElements(elements, true)
		
		let debugDataArray: levelRefreshDebugData[] = []
		
		for (const res of results) {
			if(!res) continue

			debugDataArray.push(res.debugData)
		}
		
		if(debugDataArray.length === 0) {
			logger.debug("LevelUpdater.multi: no new plays to post", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
			return {
				result: UPDATE_STATUS.NO_UPDATE
			}
		}

		time.endTime("Post Maps")

		await afterPlaysPosted(time, "multi")

		time.endTime("Total")

		const combinedData = debugDataArray.reduce<{
			newMaps: number,
			newPlays: number,
			getAverage: number,
			players: string[]
		}>((acc, value) => ({
			newMaps: acc.newMaps + value.newMaps,
			newPlays: acc.newPlays + value.newPlays,
			getAverage: (acc.getAverage + value.getAverage) / 2,
			players: [...acc.players, value.player]
		}), {
			newMaps: 0,
			newPlays: 0,
			getAverage: 0,
			players: []
		})

		time.addLineBreak()
			.addText(`Updated players: ${combinedData.players}`, 1)
			.addText(`NewMaps: ${combinedData.newMaps}`, 1)
			.addText(`NewPlays: ${combinedData.newPlays}`, 1)
			.addText(`Average Time Per Request: ${combinedData.getAverage.toFixed(2)}s`, 1)

		logger.info("Finished LevelUpdater.multi")

		return {
			result: UPDATE_STATUS.SUCCESS,
			status: time
		}
	}
}
