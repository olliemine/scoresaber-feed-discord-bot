import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler, { DiscordVariables } from "../../classes/sentMessageHandler.js"
import userSchema from "../../models/userSchema.js"
import levelSchema from "../../models/levelSchema.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { createLevelCounts, levelCountsToBulkWrite } from "../../update/levelCounts.js"
import { logger } from "../../logger.js"
import { unexpectedErrorInteractionHandler } from "../../discord/message/interactions.js"
import { UserFeedUpdater } from "../../feed/userFeed.js"

const command: BotCommand = {
	name: "resetplaysnumbers",
	category: "Master",
	description: "resetPlaysNumbers",
	level: COMMAND_PERMISSIONS.MASTER,
	cooldown: -1,
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).loading({ description: `Getting information... ${DiscordVariables.LOADING_EMOJI}` })

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
			
			await sentMessage.loading({ description: `Saving information... ${DiscordVariables.LOADING_EMOJI}` })
	
			const counts = createLevelCounts()
	
			for(const count of arrayCounts) {
				counts.totalPlayedCount[count._id] = count.totalPlayedCount
				counts.top1Single[count._id] = count.top1Single
				counts.top1Multi[count._id] = count.top1Multi
			}

			const userBulkWrite = await levelCountsToBulkWrite(counts)

			await userSchema.bulkWrite(userBulkWrite)
		
			const updatedUsers = await userSchema.find()
			await UserFeedUpdater.multi(updatedUsers.map(dataUser => dataUser.toObject()))

			sentMessage.localesSuccess()
		} catch(err) {
			logger.unknownError(err)
			unexpectedErrorInteractionHandler(err, sentMessage)
		}
	},
}

export default command