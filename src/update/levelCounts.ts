import { user } from "../types/db.js"
import mongodb from "mongodb"

export function getScore(player: {
	score: {
		modifiedScore: number
		baseScore?: number
	}
	[x: string]: unknown
}, _positiveModifiers?: boolean) {
	return player.score.modifiedScore
}

const LEVEL_COUNTS_UPDATE: {[key in keyof levelCounts]: { porcent: boolean }} = {
	totalPlayedCount: {
		porcent: false
	},
	top1Single: {
		porcent: true
	},
	top1Multi: {
		porcent: true
	}
}

export function createLevelCounts(): levelCounts {
	return {
		totalPlayedCount: {},
		top1Single: {},
		top1Multi: {}
	}
}

export type levelCounts = {
	totalPlayedCount: {[key: string]: number},
	top1Single: {[key: string]: number},
	top1Multi: {[key: string]: number}
}

export function levelCountsToBulkWrite(counts: levelCounts): mongodb.AnyBulkWriteOperation<user>[] {
	let category: string
	let playerID: string
	let bulkWrite: {
		updateOne: {
			filter: mongodb.Filter<user>,
			update: { $set: any }
		}
	}[] = []

	for(category of Object.keys(counts)) {
		for(playerID of Object.keys(counts[category as keyof levelCounts])) {
			const count = counts[category as keyof levelCounts][playerID]
			let operationIndex = bulkWrite.findIndex(o => o.updateOne.filter.scoresaberID === playerID)

			const value = LEVEL_COUNTS_UPDATE[category as keyof levelCounts].porcent ? ".value" : ""

			if(operationIndex === -1) {
				operationIndex = bulkWrite.push({ 
					updateOne: {
						filter: { scoresaberID: playerID },
						update: { $set: { [`${category}${value}`]: count } }
					}
				}) - 1
			} else {
				bulkWrite[operationIndex].updateOne.update.$set[`${category}${value}`] = count
			}

			if(!LEVEL_COUNTS_UPDATE[category as keyof levelCounts].porcent) continue
			
			const userTotalPlayedCount = counts.totalPlayedCount[playerID]

			bulkWrite[operationIndex].updateOne.update.$set[`${category}-porcent.value`] = count / userTotalPlayedCount
		}
	}

	return bulkWrite
}
