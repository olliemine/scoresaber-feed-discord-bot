import { wait } from "../../misc/util.js"
import levelSchema from "../../models/levelSchema.js"
import {
	buildScoreIdLookup,
	fetchPlayerScorePage,
	lookupScoreId
} from "./scoreApi.js"
import mongodb from "mongodb"

const BULK_WRITE_CHUNK = 500
const PLAYER_PAGE_DELAY_MS = 150

export type MigrateScoreIdsResult = {
	playersProcessed: number,
	alreadyHadId: number,
	matched: number,
	unmatched: number,
	updated: number
}

export async function migrateScoreIds(
	onProgress?: (message: string) => void | Promise<void>
): Promise<MigrateScoreIdsResult> {
	const playerIds: string[] = await levelSchema.distinct("leaderboard.playerID")
	const lookup = new Map<string, number>()

	for(const [index, playerId] of playerIds.entries()) {
		await onProgress?.(`Fetching API scores for player ${index + 1}/${playerIds.length} (${playerId})`)

		let page = 1
		while(true) {
			const res = await fetchPlayerScorePage(playerId, page, 100, "recent")
			if(!res?.data.length) break

			const pageLookup = buildScoreIdLookup(res.data)
			pageLookup.forEach((scoreId, key) => lookup.set(key, scoreId))

			if(page >= res.metadata.totalPages) break
			page++
		}

		if(index < playerIds.length - 1) await wait(PLAYER_PAGE_DELAY_MS)
	}

	const levels = await levelSchema.find().lean()
	const bulkOps: mongodb.AnyBulkWriteOperation[] = []

	let alreadyHadId = 0
	let matched = 0
	let unmatched = 0

	for(const levelDoc of levels) {
		const levelID = levelDoc.levelID
		for(let i = 0; i < levelDoc.leaderboard.length; i++) {
			const entry = levelDoc.leaderboard[i]
			if(entry.score.scoreID != null) {
				alreadyHadId++
				continue
			}

			const scoreId = lookupScoreId(
				lookup,
				levelID,
				entry.playerID,
				new Date(entry.date),
				entry.score.modifiedScore,
				entry.score.baseScore
			)

			if(scoreId == null) {
				unmatched++
				continue
			}

			matched++
			bulkOps.push({
				updateOne: {
					filter: { levelID },
					update: { $set: { [`leaderboard.${i}.score.scoreID`]: scoreId } }
				}
			})
		}
	}

	let updated = 0
	for(let i = 0; i < bulkOps.length; i += BULK_WRITE_CHUNK) {
		const chunk = bulkOps.slice(i, i + BULK_WRITE_CHUNK)
		await onProgress?.(`Writing score IDs ${Math.min(i + chunk.length, bulkOps.length)}/${bulkOps.length}...`)
		const res = await levelSchema.bulkWrite(chunk, { ordered: false })
		updated += res.modifiedCount
	}

	return {
		playersProcessed: playerIds.length,
		alreadyHadId,
		matched,
		unmatched,
		updated
	}
}
