import { beatsaverAPI } from "../constants.js"
import getConfig from "../config/getConfig.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { fetchWithRetry, responseErrorString } from "../misc/util.js"
import { getRankedMapsPage } from "../scoresaber/handlers/links.js"
import { Root } from "../types/beatsaver.js"
import { LevelDifficulties } from "../types/external.js"
import { RankedleDifficulty, RankedleSong } from "../types/rankedle.js"
import { ScoreSaberMap, ScoreSaberMaps } from "../types/scoresaber.js"

const TOTAL_CACHE_MS = 1000 * 60 * 60
const MAX_ATTEMPTS = 5

let cachedTotal: { value: number, expiresAt: number } | null = null

async function fetchMapsPage(page: number, limit: number): Promise<ScoreSaberMaps> {
	const { minStars, maxStars } = getConfig().commands.rankedle

	const response = await fetchWithRetry(getRankedMapsPage(page, limit, minStars, maxStars))

	if(!response.ok) throw new Error(responseErrorString(response))

	return await response.json() as ScoreSaberMaps
}

async function getRankedMapCount(): Promise<number> {
	if(cachedTotal && cachedTotal.expiresAt > Date.now()) return cachedTotal.value

	const { metadata } = await fetchMapsPage(1, 1)

	cachedTotal = { value: metadata.totalItems, expiresAt: Date.now() + TOTAL_CACHE_MS }

	return metadata.totalItems
}

async function fetchBeatsaverMap(hash: string): Promise<Root> {
	const response = await fetchWithRetry(new URL(`${beatsaverAPI}/maps/hash/${hash}`))

	if(!response.ok) throw new Error(responseErrorString(response))

	return await response.json() as Root
}

function toDifficulties(map: ScoreSaberMap): RankedleDifficulty[] {
	const stars = new Map<LevelDifficulties.FullNameFormated, number | null>()

	for(const board of map.leaderboards) {
		const difficulty = LevelDifficulties.Array.find(entry => entry.Number === board.difficulty)

		if(!difficulty) continue

		const value = board.realm.leaderboardStatus === "RANKED" ? board.realm.stars : null
		const known = stars.get(difficulty.FullNameFormated)

		if(known === undefined || (known === null && value !== null)) stars.set(difficulty.FullNameFormated, value)
	}

	return LevelDifficulties.Array
		.filter(difficulty => stars.has(difficulty.FullNameFormated))
		.map(difficulty => ({ name: difficulty.FullNameFormated, stars: stars.get(difficulty.FullNameFormated) ?? null }))
}

export async function pickSong(excludedHashes: string[]): Promise<RankedleSong> {
	const total = await getRankedMapCount()

	if(!total) throw new Error("ScoreSaber returned no ranked maps for the configured filters")

	for(let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const { data } = await fetchMapsPage(1 + Math.floor(Math.random() * total), 1)
		const map = data[0]

		if(!map || !map.bsid || excludedHashes.includes(map.hash)) continue

		const beatsaverMap = await fetchBeatsaverMap(map.hash)
		const version = beatsaverMap.versions.find(version => version.hash.toLowerCase() === map.hash.toLowerCase()) ?? beatsaverMap.versions[0]

		if(!version || !beatsaverMap.metadata.duration) continue

		logger.debug(`Rankedle picked ${map.songName} by ${map.songAuthorName}`, DEBUG_LEVELS.USER_DEBUG)

		return {
			beatsaverID: map.bsid,
			hash: map.hash,
			name: map.songName,
			songAuthor: map.songAuthorName,
			levelAuthor: map.levelAuthorName,
			duration: beatsaverMap.metadata.duration,
			coverUrl: map.coverUrl,
			downloadUrl: version.downloadURL,
			difficulties: toDifficulties(map)
		}
	}

	throw new Error(`No ranked song could be picked after ${MAX_ATTEMPTS} attempts`)
}
