import {
	ScoreSaberPlayersScoreData,
	ScoreSaberPlayersScores,
	ScoreSaberScoreByIdResponse
} from "../../types/scoresaber.js"
import { fetchWithRetry, responseErrorString } from "../../misc/util.js"
import {
	getScoreByIdString,
	getScorePageString,
	getTopScorePageString
} from "./links.js"

const SCORE_MATCH_TOLERANCE_MS = 1000

export function scoreMatchKey(
	leaderboardId: number,
	playerId: string,
	createdAt: Date | string | number,
	modifiedScore: number
) {
	const ms = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
	return `${leaderboardId}|${playerId}|${ms}|${modifiedScore}`
}

export function scoreMatchKeysForEntry(
	leaderboardId: number,
	playerId: string,
	createdAt: Date | string,
	modifiedScore: number,
	unmodifiedScore?: number
) {
	const keys = [scoreMatchKey(leaderboardId, playerId, createdAt, modifiedScore)]
	if(unmodifiedScore != null && unmodifiedScore !== modifiedScore) {
		keys.push(scoreMatchKey(leaderboardId, playerId, createdAt, unmodifiedScore))
	}
	const baseMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
	for(const offset of [-SCORE_MATCH_TOLERANCE_MS, SCORE_MATCH_TOLERANCE_MS]) {
		keys.push(scoreMatchKey(leaderboardId, playerId, baseMs + offset, modifiedScore))
		if(unmodifiedScore != null && unmodifiedScore !== modifiedScore) {
			keys.push(scoreMatchKey(leaderboardId, playerId, baseMs + offset, unmodifiedScore))
		}
	}
	return keys
}

export async function fetchScoreById(scoreId: number): Promise<ScoreSaberScoreByIdResponse | null> {
	const res = await fetchWithRetry(getScoreByIdString(scoreId))
	if(!res.ok) return null
	return await res.json() as ScoreSaberScoreByIdResponse
}

export async function fetchPlayerScorePage(
	playerId: string,
	page: number,
	limit: number,
	sort: "recent" | "top"
): Promise<ScoreSaberPlayersScores | null> {
	const url = sort === "top"
		? getTopScorePageString(playerId, limit.toString(), page.toString())
		: getScorePageString(playerId, limit.toString(), page.toString())

	const res = await fetchWithRetry(url)
	if(!res.ok) throw new Error(responseErrorString(res))
	return await res.json() as ScoreSaberPlayersScores
}

export function buildScoreIdLookup(scores: ScoreSaberPlayersScoreData[]) {
	const lookup = new Map<string, number>()
	for(const entry of scores) {
		const scoreId = entry.score.id
		for(const key of scoreMatchKeysForEntry(
			entry.leaderboard.id,
			entry.score.player.id,
			entry.score.createdAt,
			entry.score.modifiedScore,
			entry.score.unmodifiedScore
		)) {
			lookup.set(key, scoreId)
		}
	}
	return lookup
}

export function lookupScoreId(
	lookup: Map<string, number>,
	leaderboardId: number,
	playerId: string,
	date: Date,
	modifiedScore: number,
	baseScore?: number
): number | undefined {
	for(const key of scoreMatchKeysForEntry(leaderboardId, playerId, date, modifiedScore, baseScore)) {
		const id = lookup.get(key)
		if(id != null) return id
	}
	return undefined
}
