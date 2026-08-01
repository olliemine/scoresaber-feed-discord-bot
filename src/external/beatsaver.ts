import { DEBUG_LEVELS, logger } from "../logger.js"
import { level } from "../types/db.js"
import { LevelDifficulties } from "../types/external.js"
import levelSchema from "../models/levelSchema.js"
import mongodb from "mongodb"
import { Diff, MapsRequest, Root } from "../types/beatsaver.js"
import { beatsaverAPI } from "../constants.js"
import { fetchWithRetry, responseErrorString } from "../misc/util.js"

const HASH_CHUNK_SIZE = 50

export const BEATSAVER_REFRESH_DATA_PROJECTION = {
	hash: 1,
	levelID: 1,
	difficultyInformation: 1,
	maxScore: 1,
	NPS: 1,
	BPM: 1,
	code: 1,
} as const

/** Levels that still need BeatSaver enrichment (missing code and/or NPS). */
const NEEDS_BEATSAVER_QUERY = {
	isDeleted: false,
	$or: [
		{ code: { $exists: false } },
		{ code: null },
		{ NPS: { $exists: false } },
		{ NPS: null },
	],
}

type LevelFields = {
	code?: string
	beatsaverLabels?: string[]
	NPS?: number
	BPM?: number
	maxScore?: number
	isDeleted?: boolean
}

type PendingLevel = {
	levelID: number
	name: LevelDifficulties.FullName
	characteristic: string
	maxScore?: number
	NPS?: number
	BPM?: number
	code?: string
}

/** ScoreSaber stores SoloStandard / etc; BeatSaver uses Standard / etc. */
function toCharacteristic(modeName: string) {
	return modeName.replace(/^(Solo|Party|Multiplayer)/, "")
}

function difficultyName(difficultyNum: number): LevelDifficulties.FullName {
	return LevelDifficulties.Array.find(d => d.Number === difficultyNum)?.FullName ?? "Easy"
}

function maxScoreFromDiff(diff: Diff) {
	if(diff.maxScore) return diff.maxScore

	const n = diff.notes
	if(!n) return undefined
	if(n === 1) return 115
	if(n <= 4) return 115 + (n - 1) * 230
	if(n <= 13) return 1035 + (n - 5) * 460
	return 4715 + (n - 13) * 920
}

function setOp(levelID: number, fields: LevelFields): mongodb.AnyBulkWriteOperation<level> {
	return { updateOne: { filter: { levelID }, update: { $set: fields } } }
}

function resolveMap(body: MapsRequest, hash: string): Root | undefined {
	if("id" in body) return body as Root
	return body[hash.toLowerCase()]
}

async function applyHashChunk(hashes: string[], byHash: Map<string, PendingLevel[]>) {
	const res = await fetchWithRetry(new URL(`${beatsaverAPI}/maps/hash/${hashes.join(",")}`))
	const deleteOps = (levels: PendingLevel[]) => levels.map(l => setOp(l.levelID, { isDeleted: true }))

	if(res.status === 404) {
		await levelSchema.bulkWrite(hashes.flatMap(h => deleteOps(byHash.get(h) ?? [])))
		return
	}

	if(!res.ok) throw new Error(responseErrorString(res))

	const body: MapsRequest = await res.json()
	const operations: mongodb.AnyBulkWriteOperation<level>[] = []

	for(const hash of hashes) {
		const pending = byHash.get(hash) ?? []
		const map = resolveMap(body, hash)
		const version = map?.versions.find(v => v.hash.toLowerCase() === hash.toLowerCase())

		if(!map || !version) {
			operations.push(...deleteOps(pending))
			continue
		}

		for(const level of pending) {
			const diff = version.diffs.find(d =>
				d.characteristic === level.characteristic && d.difficulty === level.name
			)

			// Map exists for this hash but not this characteristic/difficulty — stop re-queueing.
			if(!diff) {
				operations.push(setOp(level.levelID, { isDeleted: true }))
				continue
			}

			const fields: LevelFields = {}
			if(level.code == null) fields.code = map.id
			if(map.tags != null) fields.beatsaverLabels = map.tags

			const bpm = map.metadata?.bpm
			if(bpm != null && level.BPM !== bpm) fields.BPM = bpm

			const maxScore = maxScoreFromDiff(diff)
			if(maxScore != null && level.maxScore !== maxScore) fields.maxScore = maxScore
			if(diff.nps != null && level.NPS !== diff.nps) fields.NPS = diff.nps

			if(Object.keys(fields).length) operations.push(setOp(level.levelID, fields))
		}
	}

	if(operations.length) await levelSchema.bulkWrite(operations)
}

async function enrichMaps(levels: level[]) {
	if(!levels.length) return

	const byHash = new Map<string, PendingLevel[]>()

	for(const lvl of levels) {
		const pending: PendingLevel = {
			levelID: lvl.levelID,
			name: difficultyName(lvl.difficultyInformation.difficultyNum),
			characteristic: toCharacteristic(lvl.difficultyInformation.modeName),
			maxScore: lvl.maxScore,
			NPS: lvl.NPS,
			BPM: lvl.BPM,
			code: lvl.code,
		}

		const group = byHash.get(lvl.hash)
		if(group) group.push(pending)
		else byHash.set(lvl.hash, [pending])
	}

	const hashes = [...byHash.keys()]
	logger.debug(`BeatSaver map chunks: ${Math.ceil(hashes.length / HASH_CHUNK_SIZE)}`, DEBUG_LEVELS.VARIABLE_DEBUG)

	for(let i = 0; i < hashes.length; i += HASH_CHUNK_SIZE) {
		await applyHashChunk(hashes.slice(i, i + HASH_CHUNK_SIZE), byHash)
	}
}

export async function getMapsMissingChecking() {
	return levelSchema.find(NEEDS_BEATSAVER_QUERY, BEATSAVER_REFRESH_DATA_PROJECTION)
}

export async function getCodesOfMissingCodeMaps() {
	const levels = await getMapsMissingChecking()
	if(!levels.length) return

	logger.debug(`Getting Map Chunks (${levels.length} levels)`, DEBUG_LEVELS.VARIABLE_DEBUG)
	await enrichMaps(levels)
}

export async function getCodeOfMaps(levels: level[]) {
	const siblings = await Promise.all(levels.map(lvl =>
		levelSchema.find({
			hash: lvl.hash,
			levelID: { $ne: lvl.levelID },
			isDeleted: false,
		}, BEATSAVER_REFRESH_DATA_PROJECTION)
	))

	const byId = new Map<number, level>()
	for(const lvl of [...levels, ...siblings.flat()]) byId.set(lvl.levelID, lvl)

	await enrichMaps([...byId.values()])
}
