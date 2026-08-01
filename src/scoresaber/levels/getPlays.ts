import { DEBUG_LEVELS, logger } from "../../logger.js"
import { user } from "../../types/db.js"
import { getAllPlays, getPlaysPages, getTotalScores, SCORES_PAGE_SIZE } from "../player/playerFunctions.js"
import levelSchema from "../../models/levelSchema.js"
import userSchema from "../../models/userSchema.js"
import { ScoreSaberPlay } from "../../classes/scoreSaberPlay.js"

/** Only fetch recent pages when the gap is at most this many plays. */
const MAX_DELTA_FOR_RECENT_FETCH = 500
/** Extra recent page so a score landing mid-refresh is still covered. */
const RECENT_PAGE_BUFFER = 1

export function sortMostRecent(plays: ScoreSaberPlay[]) {
	if(plays.length > 1 && plays[plays.length - 1].timeSet.getTime() > plays[0].timeSet.getTime()) plays.reverse()
	return plays
}

async function syncPlayedCount(user: user, totalScores: number, reason: string) {
	if(user.totalPlayedCount === totalScores) return

	logger.debug(
		`getNotSavedPlays: ${reason} for ${user.scoresaberName} (db=${user.totalPlayedCount} -> api=${totalScores})`,
		DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
	)

	await userSchema.updateOne(
		{ scoresaberID: user.scoresaberID },
		{ totalPlayedCount: totalScores }
	)
	user.totalPlayedCount = totalScores
}

async function getSavedPlayDates(scoresaberID: string): Promise<number[]> {
	const playDatesAggregation = await levelSchema.aggregate([{
		$match: {
			"leaderboard.playerID": scoresaberID
		}
	}, {
		$unwind: "$leaderboard"
	}, {
		$match: {
			"leaderboard.playerID": scoresaberID
		}
	}, {
		$project: {
			date: "$leaderboard.date"
		}
	}])

	return playDatesAggregation.map(p => (p.date as Date).getTime())
}

function filterUnsavedPlays(playerScores: ScoreSaberPlay[], playDates: number[]) {
	const remainingDates = [...playDates]

	return playerScores.filter(score => {
		const timeSet = score.timeSet.getTime()
		const index = remainingDates.findIndex((v) => v === timeSet)
		if(index === -1) return true
		remainingDates.splice(index, 1)
		return false
	})
}

export async function getNotSavedPlays(user: user, totalScores?: number) {
	logger.debug(
		`getNotSavedPlays: start for ${user.scoresaberName} (${user.scoresaberID}), dbCount=${user.totalPlayedCount}, apiCount=${totalScores ?? "pending"}`,
		DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
	)

	if(totalScores == null) {
		const resTotalScores = await getTotalScores(user.scoresaberID)
		if(resTotalScores === false) throw new Error(`Not found total scores in user ${user.scoresaberID}`)
		totalScores = resTotalScores
		logger.debug(
			`getNotSavedPlays: resolved apiCount=${totalScores} for ${user.scoresaberName}`,
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)
	}

	const dbCount = user.totalPlayedCount ?? 0
	const delta = totalScores - dbCount

	if(delta === 0) {
		logger.debug(
			`getNotSavedPlays: done for ${user.scoresaberName}, play count already in sync`,
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)
		return []
	}

	// API behind DB (or equal after drift) — trust API and stop refetch loops
	if(delta < 0) {
		await syncPlayedCount(user, totalScores, "syncing play count down to API")
		return []
	}

	const useRecentPages = !!user.scoresaberLastMap && delta <= MAX_DELTA_FOR_RECENT_FETCH
	const recentPages = Math.ceil(delta / SCORES_PAGE_SIZE) + RECENT_PAGE_BUFFER

	logger.debug(
		useRecentPages
			? `getNotSavedPlays: fetching ${recentPages} recent page(s) for ${user.scoresaberName} (delta=${delta})`
			: `getNotSavedPlays: fetching full history for ${user.scoresaberName} (${Math.ceil(totalScores / SCORES_PAGE_SIZE)} pages, delta=${delta})`,
		DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
	)

	let playerScores = useRecentPages
		? await getPlaysPages(user.scoresaberID, recentPages)
		: await getAllPlays(user.scoresaberID, totalScores)

	if(!playerScores) throw new Error("Unexpected Error while fetching all scores")

	playerScores = sortMostRecent(playerScores)

	logger.debug(
		`getNotSavedPlays: fetched ${playerScores.length} plays for ${user.scoresaberName}, filtering unsaved...`,
		DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
	)

	if(!user.scoresaberLastMap) {
		logger.debug(
			`getNotSavedPlays: done for ${user.scoresaberName}, ${playerScores.length} new plays (no lastMap)`,
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)
		return playerScores
	}

	const playDates = await getSavedPlayDates(user.scoresaberID)

	if(!playDates.length) {
		logger.debug(
			`getNotSavedPlays: done for ${user.scoresaberName}, ${playerScores.length} new plays (no saved dates)`,
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)
		return playerScores
	}

	const unsavedPlays = filterUnsavedPlays(playerScores, playDates)

	logger.debug(
		`getNotSavedPlays: done for ${user.scoresaberName}, ${unsavedPlays.length} unsaved of ${playerScores.length} fetched`,
		DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
	)

	// Ghost count: API reports more plays than we can find, or pages are all already saved
	if(unsavedPlays.length === 0) {
		await syncPlayedCount(user, totalScores, "ghost play count sync (0 unsaved)")
		return []
	}

	return unsavedPlays
}
