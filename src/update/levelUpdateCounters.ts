import { UserFeedUpdater } from "../feed/userFeed.js"
import { logger } from "../logger.js"
import levelSchema from "../models/levelSchema.js"
import userSchema from "../models/userSchema.js"
import { createLevelCounts, levelCountsToBulkWrite } from "./levelCounts.js"

export default async function levelUpdateCounters(options?: { skipFeed?: boolean }) {
	try {
		const arrayCounts: {
			_id: string,
			totalPlayedCount: number,
			top1Single: number,
			top1Multi: number
		}[] = await levelSchema.aggregate([
			{
				'$addFields': {
					'leaderboardLength': {
						'$size': '$leaderboard'
					}
				}
			}, {
				'$unwind': {
					'path': '$leaderboard',
					'includeArrayIndex': 'index',
					'preserveNullAndEmptyArrays': false
				}
			}, {
				'$group': {
					'_id': '$leaderboard.playerID',
					'totalPlayedCount': {
						'$count': {}
					},
					'top1Single': {
						'$sum': {
							'$cond': {
								'if': {
									'$eq': [
										'$index', 0
									]
								},
								'then': 1,
								'else': 0
							}
						}
					},
					'top1Multi': {
						'$sum': {
							'$cond': {
								'if': {
									'$and': [
										{
											'$eq': [
												'$index', 0
											]
										}, {
											'$gte': [
												'$leaderboardLength', 2
											]
										}
									]
								},
								'then': 1,
								'else': 0
							}
						}
					}
				}
			}
		])
		
		const counts = createLevelCounts()

		for(const count of arrayCounts) {
			counts.totalPlayedCount[count._id] = count.totalPlayedCount
			counts.top1Single[count._id] = count.top1Single
			counts.top1Multi[count._id] = count.top1Multi
		}

		const userBulkWrite = levelCountsToBulkWrite(counts)

		await userSchema.bulkWrite(userBulkWrite)

		// WS path refreshes profiles after counters; skip feed so PP lastFeed isn't advanced early
		if(options?.skipFeed) return
	
		const updatedUsers = await userSchema.find()
		await UserFeedUpdater.multi(updatedUsers.map(dataUser => dataUser.toObject()))
	} catch(err) {
		logger.unknownError(err)
	}
}