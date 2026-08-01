import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import getLanguage from "../../languages/lang.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getDataUserFromDiscordUser, isSaved } from "../../discord/account/userFunctions.js"
import levelSchema from "../../models/levelSchema.js"
import userSchema from "../../models/userSchema.js"
import { PipelineStage } from "mongoose"
import { applyStandardFiltersInteraction, applyStandardFiltersOptions, getStandardFiltersInteraction, playlistAutocompleteHandler, sendPlaylist } from "../../playlists/discordHandler.js"
import { user } from "../../types/db.js"
import { getProfilePicture } from "../../scoresaber/player/playerFunctions.js"
import { PlaylistLevel, URLtoBase64 } from "../../playlists/generatePlaylist.js"
import { getScoresaberPlayer } from "../../scoresaber/handlers/getScoreSaberPlayer.js"
import { userSelection } from "../../discord/message/interactions.js"
import { getSnipedPlaysUnknownPlayer } from "../../playlists/filter.js"
import { addSearch } from "../../discord/autocomplete/cache.js"
import { scoreCondition } from "../../db/levelPipelines.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

function createBeforePipeline(dataUser: user, snipedDataUser: user): PipelineStage[] {
	return [
		{
			$match: {
				"leaderboard.playerID": {
					$in: [
						dataUser.scoresaberID,
						snipedDataUser.scoresaberID,
					],
				},
			},
		},
		{
			$unwind: "$leaderboard",
		},
		{
			$match: {
				"leaderboard.playerID": {
					$in: [
						dataUser.scoresaberID,
						snipedDataUser.scoresaberID,
					],
				},
			},
		},
		{
			$addFields: {
				score: scoreCondition,
			},
		},
		{
			$sort: {
				score: -1,
			},
		},
		{
			$group: {
				_id: "$levelID",
				levelID: {
					$first: "$levelID",
				},
				NPS: {
					$first: "$NPS"
				},
				hash: {
					$first: "$hash",
				},
				code: {
					$first: "$code",
				},
				difficultyInformation: {
					$first: "$difficultyInformation",
				},
				positiveModifiers: {
					$first: "$positiveModifiers",
				},
				stars: {
					$first: "$stars"
				},
				beatsaverLabels: {
					$first: "$beatsaverLabels"
				},
				ranked: {
					$first: "$ranked"
				},
				player1: {
					$first: "$leaderboard",
				},
				player2: {
					$last: "$leaderboard",
				},
			},
		},
		{
			$match: {
				$expr: {
					$ne: [
						"$player1.playerID",
						"$player2.playerID",
					],
				},
			},
		},
		{
			$match: {
				$expr: {
					$eq: [
						"$player1.playerID",
						snipedDataUser.scoresaberID,
					],
				},
			},
		},
	]
}

const command: BotCommand = {
	name: "snipeplaylist",
	category: "Playlist",
	description: getLanguage.getDefault("playlistSnipeDescription"),
	descriptionLocale: "playlistSnipeDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 30,
	slashCommand: applyStandardFiltersOptions(new SlashCommandBuilder()
		.setName("snipeplaylist")
		.setDescription(getLanguage.getDefault("playlistSnipeDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("playlistSnipeDescription"))
		.addStringOption(option => option.setName("player")
			.setDescription(getLanguage.getDefault("playlistPlayerDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistPlayerDescription"))
			.setRequired(true)
			.setAutocomplete(true))
	),
	autocomplete: playlistAutocompleteHandler,
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const dataUser = await getDataUserFromDiscordUser(sentMessage.author)

		if (dataUser == null) return sentMessage.localesError("userNeedsToBeLoggedIn")
		if (!isSaved(dataUser)) return sentMessage.localesError("accountDoesntSavePlays")

		let snipedScoresaberUser

		const snipedScoresaberUserRes = await getScoresaberPlayer(message.options.getString("player") ?? "", true)

		if (snipedScoresaberUserRes.status === false) return sentMessage.error({ description: snipedScoresaberUserRes.body })

		if (snipedScoresaberUserRes.body[1]) {
			snipedScoresaberUser = await userSelection(snipedScoresaberUserRes.body, sentMessage, "scoresaberUsers")
			if (!snipedScoresaberUser) return
		} else {
			snipedScoresaberUser = snipedScoresaberUserRes.body[0]
		}

		const snipedDataUser = await userSchema.findOne({ "scoresaberID": snipedScoresaberUser.id })

		let maps: PlaylistLevel[]

		if (snipedDataUser &&
			snipedDataUser["scoresaberID"] === dataUser["scoresaberID"]) return sentMessage.localesError("playlistCantSnipedSelf")

		if (!snipedDataUser) {
			sentMessage.localesLoading("gettingPlays")

			const [filters, errorFilters] = getStandardFiltersInteraction(message)

			if (errorFilters) return sentMessage.localesError(errorFilters)

			const [snipedPlays, errorPlays] = await getSnipedPlaysUnknownPlayer(filters, dataUser, snipedScoresaberUser.id)

			if (errorPlays) return sentMessage.localesError(errorPlays)

			maps = snipedPlays
		} else {
			const beforePipeline = createBeforePipeline(dataUser, snipedDataUser)

			const getDateOfPlay = {
				$addFields: {
					playDate: "$player1.date"
				}
			}

			const [pipeline, error] = applyStandardFiltersInteraction(message, getDateOfPlay, beforePipeline)

			if (error) return sentMessage.localesError(error)

			maps = await levelSchema.aggregate(pipeline)
		}

		if (maps == null || maps[0] == null) return sentMessage.localesError("playlistNoMapFound")

		addSearch(sentMessage.author.id, "dataUser", { name: snipedScoresaberUser.name, value: snipedScoresaberUser.id })

		const profilePicture = await getProfilePicture(snipedScoresaberUser.id)
		const profilePictureBase64 = await URLtoBase64(profilePicture)

		sendPlaylist(
			maps,
			sentMessage,
			`${snipedScoresaberUser.name} Snipe Playlist`,
			`${snipedScoresaberUser.name}snipes.json`,
			profilePictureBase64
		)
	},
}

export default command