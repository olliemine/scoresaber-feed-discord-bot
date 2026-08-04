import { DEBUG_LEVELS, logger } from "../logger.js"
import { getJSON, writeJSON } from "../misc/jsonController.js"
import { RankedleLeaderboardEntry, RankedlePlayer } from "../types/rankedle.js"

export const LEADERBOARD_PAGE_SIZE = 10

let leaderboard: RankedleLeaderboardEntry[] = []

function sort() {
	leaderboard.sort((first, second) => second.globalScore - first.globalScore)
}

export async function load() {
	leaderboard = await getJSON("rankedleLeaderboard")
	sort()

	logger.debug(`Rankedle leaderboard loaded with ${leaderboard.length} players`, DEBUG_LEVELS.INCEPTION_DEBUG)
}

export async function applyScores(players: RankedlePlayer[]) {
	for(const player of players) {
		if(!player.score) continue

		const entry = leaderboard.find(entry => entry.id === player.id)

		if(entry) {
			entry.globalScore += player.score
			entry.name = player.name
			continue
		}

		leaderboard.push({ id: player.id, name: player.name, globalScore: player.score })
	}

	sort()

	await writeJSON("rankedleLeaderboard", leaderboard)
}

export const getTop = (count: number) => leaderboard.slice(0, count)
export const getPage = (page: number, pageSize: number) => leaderboard.slice((page - 1) * pageSize, page * pageSize)
export const getTotalPages = (pageSize: number) => Math.ceil(leaderboard.length / pageSize)
