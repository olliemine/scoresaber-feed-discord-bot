import { getUserCountry, isFromMainCountry } from "../discord/account/userFunctions.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { user } from "../types/db.js"
import { postUserFeed } from "./userFeedMessage.js"
import userSchema from "../models/userSchema.js"
import { AnyObject } from "mongoose"
import { UPDATE_RESULT, UPDATE_STATUS } from "../types/util.js"

export type UserFeedChanges =
	| "scoresaberLastAverageAccuracy"
	| "scoresaberLastPP"
	| "scoresaberRank"
	| "scoresaberCountryRank"
	| "mainCountriesRank"
	| "top1Multi"
	| "top1Multi-porcent"

const ACCEPTED_CHANGES: UserFeedChanges[] = [
	"scoresaberLastAverageAccuracy",
	"scoresaberLastPP",
	"scoresaberRank",
	"scoresaberCountryRank",
	"mainCountriesRank",
	"top1Multi",
	"top1Multi-porcent"
]

const RANK_FEED_CHANGES: UserFeedChanges[] = [
	"scoresaberRank",
	"scoresaberCountryRank",
	"mainCountriesRank"
]

export function isRankFeedChange(change: UserFeedChanges) {
	return RANK_FEED_CHANGES.includes(change)
}

/** Global/country rank (and PP snapshots) are country-agnostic; community metrics require main countries. */
function isEligibleForFeedChange(dataUser: user, change: UserFeedChanges) {
	if(change === "scoresaberRank" || change === "scoresaberCountryRank" || change === "scoresaberLastPP") {
		return true
	}

	return isFromMainCountry(getUserCountry(dataUser))
}

function shouldPostFeed(dataUser: user, change: UserFeedChanges) {
	if(dataUser[change].lastFeed === 0) return false

	// PP only tracks lastFeed for snipe detection; rank events own the messages
	if(change === "scoresaberLastPP") return false

	if(!isEligibleForFeedChange(dataUser, change)) return false

	if(isRankFeedChange(change)) return dataUser[change].value < dataUser[change].lastFeed

	return dataUser[change].value !== dataUser[change].lastFeed
}

export class UserFeedUpdater {
	static async single(dataUser: user): Promise<UPDATE_RESULT> {
		const changes = ACCEPTED_CHANGES.filter((change) => {
			const field = dataUser[change]
			if(!field) return false
			return field.value !== field.lastFeed
		})
		
		if(changes.length === 0) return {
			result: UPDATE_STATUS.NO_UPDATE
		}

		const updateChanges: {[key in "$set"]: AnyObject} = {
			$set: {}
		}

		// Post feeds before advancing lastFeed so PP snipe snapshots stay valid
		for await(const change of changes) {
			if(shouldPostFeed(dataUser, change)) {
				await postUserFeed(dataUser, change).catch(logger.error)
			}
		}

		// Always advance lastFeed (including ineligible metrics) so deltas don't accumulate while gated
		for(const change of changes) {
			updateChanges.$set[`${change}.lastFeed`] = dataUser[change].value
			updateChanges.$set[`${change}.lastFeedDate`] = new Date()
		}

		await userSchema.updateOne({ "scoresaberID": dataUser.scoresaberID }, updateChanges)

		return {
			result: UPDATE_STATUS.SUCCESS
		}
	}

	static async multi(dataUsers: user[]): Promise<UPDATE_RESULT> {
		if(!dataUsers.length) return {
			result: UPDATE_STATUS.NO_UPDATE
		}

		for await(const dataUser of dataUsers) {
			try {
				logger.debug(`UserFeedUpdater.multi: feed check for ${dataUser.scoresaberName}`, DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
				await UserFeedUpdater.single(dataUser)
			} catch(err) {
				logger.unknownError(err)

				return {
					result: UPDATE_STATUS.ERROR
				}
			}
		}

		return {
			result: UPDATE_STATUS.SUCCESS
		}
	}
}
