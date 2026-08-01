import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import getLanguage from "../../languages/lang.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getDataUserFromDiscordUser, isSaved } from "../../discord/account/userFunctions.js"
import levelSchema from "../../models/levelSchema.js"
import { PipelineStage } from "mongoose"
import { applyStandardFiltersInteraction, applyStandardFiltersOptions, playlistAutocompleteHandler, sendPlaylist } from "../../playlists/discordHandler.js"
import { logger } from "../../logger.js"
import { getProfilePicture } from "../../scoresaber/player/playerFunctions.js"
import { PlaylistLevel, URLtoBase64 } from "../../playlists/generatePlaylist.js"
import { scoreCondition } from "../../db/levelPipelines.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

function sortNumToString(sortNum: number) {
	switch (sortNum) {
		case 0:
			return getLanguage.getDefault("playlistSortLowAcc")
		case 1:
			return getLanguage.getDefault("playlistSortOldest")
		default:
			return ""
	}
}

const command: BotCommand = {
	name: "improveplaylist",
	category: "Playlist",
	description: getLanguage.getDefault("playlistImproveDescription"),
	descriptionLocale: "playlistImproveDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 20,
	slashCommand: applyStandardFiltersOptions(new SlashCommandBuilder()
		.setName("improveplaylist")
		.setDescription(getLanguage.getDefault("playlistImproveDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("playlistImproveDescription"))
		.addIntegerOption(option => option.setName("sort")
			.setDescription(getLanguage.getDefault("playlistSortDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistSortDescription"))
			.setChoices({
				name: getLanguage.getDefault("playlistSortLowAcc"),
				name_localizations: getLanguage.getLocalizations("playlistSortLowAcc"),
				value: 0
			}, {
				name: getLanguage.getDefault("playlistSortOldest"),
				name_localizations: getLanguage.getLocalizations("playlistSortOldest"),
				value: 1
			})
			.setRequired(true))),
	autocomplete: playlistAutocompleteHandler,
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const dataUser = await getDataUserFromDiscordUser(sentMessage.author)

		if (dataUser == null) return sentMessage.localesError("userNeedsToBeLoggedIn")
		if (!isSaved(dataUser)) return sentMessage.localesError("accountDoesntSavePlays")

		const sortNum = message.options.getInteger("sort") ?? 0

		const getDateOfPlay = {
			$addFields: {
				playDate: "$leaderboard.date"
			}
		}

		const beforePipeline: PipelineStage[] = [{
			$match: {
				"leaderboard.playerID": dataUser.scoresaberID
			}
		}, {
			$unwind: "$leaderboard"
		}, {
			$match: {
				"leaderboard.playerID": dataUser.scoresaberID
			}
		}, {
			$match: {
				"maxScore": {
					"$exists": true
				}
			}
		}]

		switch (sortNum) {
			case 0:
				beforePipeline.push({
					$match: {
						maxScore: { $exists: true }
					}
				})
				break
			default:
				break
		}

		const afterPipeline: PipelineStage[] = []

		switch (sortNum) {
			case 0:
				afterPipeline.push({
					"$addFields": {
						"score": scoreCondition
					}
				}, {
					$addFields: {
						accuracy: {
							$cond: {
								if: {
									"$or": [
										{ "$eq": ["$score", 0] },
										{ "$eq": ["$maxScore", 0] }
									]
								},
								then: 0,
								else: { $divide: ["$score", "$maxScore"] }
							}
						}
					}
				}, {
					$sort: { "accuracy": 1 }
				})
				break
			case 1:
				afterPipeline.push({
					$sort: { "leaderboard.date": 1 }
				})
				break
		}

		const [pipeline, error] = applyStandardFiltersInteraction(message, getDateOfPlay, beforePipeline, afterPipeline)

		if (error) return sentMessage.localesError(error)

		levelSchema.aggregate(pipeline).then(async (maps: PlaylistLevel[]) => {
			if (!maps || maps.length === 0) return sentMessage.localesError("playlistNoMapFound")

			const profilePicture = await getProfilePicture(dataUser.scoresaberID)

			const profilePictureBase64 = await URLtoBase64(profilePicture)

			sendPlaylist(
				maps,
				sentMessage,
				`${dataUser.scoresaberName} ${sortNumToString(sortNum)}`,
				`${dataUser.scoresaberName}${sortNumToString(sortNum).toLowerCase()}.json`,
				profilePictureBase64
			)
		}).catch((err) => {
			logger.error(err)
			sentMessage.localesError("unexpectedError")
		})
	},
}

export default command