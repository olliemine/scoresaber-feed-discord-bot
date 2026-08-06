import { ScoreSaberPlay } from "../../classes/scoreSaberPlay.js"
import { UserCategories, getUserCountry, isFromMainCountry } from "../../discord/account/userFunctions.js"
import { DEBUG_LEVELS, logger } from "../../logger.js"
import { fetchWithRetry, getPromisesFetch, responseErrorString } from "../../misc/util.js"
import { user } from "../../types/db.js"
import { AnyScoreSaberUserBody, ScoreSaberPlayersProfile, ScoreSaberPlayersScores } from "../../types/scoresaber.js"
import { idSearch } from "../handlers/getScoreSaberPlayer.js"
import { getIDFullFindString, getScorePageString, getTopScorePageString } from "../handlers/links.js"

export function checkUserCategory(scoresaberUser: AnyScoreSaberUserBody): Exclude<UserCategories, "Unknown">
export function checkUserCategory(scoresaberUser: AnyScoreSaberUserBody, dataUser: user): UserCategories
export function checkUserCategory(scoresaberUser: AnyScoreSaberUserBody, dataUser?: user): UserCategories {
	if(scoresaberUser?.banned) return "BannedUser"
	if(scoresaberUser?.inactive) return "InactiveUser"
	if(isFromMainCountry(dataUser ? getUserCountry(dataUser, scoresaberUser.country) : scoresaberUser.country)) {
		if(dataUser && !dataUser.discordID) return "Unknown"
		return "MainCountryUser"
	}
	return "NonMainCountryUser"
}

export const isUserActive = (scoresaberUser: AnyScoreSaberUserBody) => !scoresaberUser.inactive && !scoresaberUser.banned

export async function getProfilePicture(scoresaberID: string) {
	if(!scoresaberID) return null
	const basicData = await idSearch(scoresaberID, false)
	return basicData.status ? basicData.body.avatar : null
}

const SCORES_PAGE_SIZE = 100

export async function getPlaysPages(id: string, pageCount: number) {
	if(pageCount <= 0) return []

	const promises = []
	for(let i = 1; i <= pageCount; i++) {
		promises.push(getScorePageString(id, SCORES_PAGE_SIZE.toString(), i.toString()))
	}

	const data = await getPromisesFetch<ScoreSaberPlayersScores>(promises, 20)
	if(!data) return null

	const playerScores: ScoreSaberPlay[] = [...data.map(a => a.data)].flat().map(play => new ScoreSaberPlay(play, "V2_SCORE"))

	logger.debug(
		`getPlaysPages: received ${playerScores.length} plays for ${id} (${pageCount} page(s))`,
		DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
	)

	return playerScores
}

export async function getAllPlays(id: string, limit: number) {
	return getPlaysPages(id, Math.ceil(limit / SCORES_PAGE_SIZE))
}

export async function getTopPlays(id: string, limit: number) {
	if(limit <= 0) return []

	const clampedLimit = Math.min(limit, 20)
	const data = await getPromisesFetch<ScoreSaberPlayersScores>([
		getTopScorePageString(id, clampedLimit.toString()),
	])
	if(!data) return null

	const playerScores: ScoreSaberPlay[] = data.flatMap(a => a.data).map(play => new ScoreSaberPlay(play, "V2_SCORE"))

	logger.debug(
		`getTopPlays: received ${playerScores.length} top plays for ${id} (limit ${clampedLimit})`,
		DEBUG_LEVELS.VARIABLE_DEBUG
	)

	return playerScores
}

export function isPlayInTopScores(score: ScoreSaberPlay, topScores: ScoreSaberPlay[]) {
	return topScores.some(top => top.levelID === score.levelID)
}

export { SCORES_PAGE_SIZE }

export async function getTotalScores(id: string): Promise<number | false> {
	const firstPageRes = await fetchWithRetry(getIDFullFindString(id))

	if(!firstPageRes.ok) throw new Error(responseErrorString(firstPageRes))

	const body = await firstPageRes.json() as ScoreSaberPlayersProfile

	const count = body.stats.totalPlayedLeaderboards

	return typeof count === "number" ? count : false
}