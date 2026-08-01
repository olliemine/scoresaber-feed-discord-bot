import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import getLanguage from "../../languages/lang.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getDataUserFromDiscordUser, isSaved } from "../../discord/account/userFunctions.js"
import { findDataUserInArgs } from "../../discord/message/interactions.js"
import { PipelineStage } from "mongoose"
import { applyStandardFiltersInteraction, applyStandardFiltersOptions, playlistAutocompleteHandler, sendPlaylist } from "../../playlists/discordHandler.js"
import { addSearch } from "../../discord/autocomplete/cache.js"
import levelSchema from "../../models/levelSchema.js"
import { getProfilePicture } from "../../scoresaber/player/playerFunctions.js"
import { PlaylistLevel, URLtoBase64 } from "../../playlists/generatePlaylist.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name: "top1playlist",
	category: "Playlist",
	description: getLanguage.getDefault("playlistTop1Description"),
	descriptionLocale: "playlistTop1Description",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 10,
	slashCommand: applyStandardFiltersOptions(new SlashCommandBuilder()
	.setName("top1playlist")
	.setDescription(getLanguage.getDefault("playlistTop1Description"))
	.setDescriptionLocalizations(getLanguage.getLocalizations("playlistTop1Description"))
	.addStringOption(option => option.setName("player")
		.setDescription(getLanguage.getDefault("playlistPlayerDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("playlistPlayerDescription"))
		.setRequired(true)
		.setAutocomplete(true))),
	autocomplete: playlistAutocompleteHandler,
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const dataUser = await getDataUserFromDiscordUser(message.user)
		let maps: PlaylistLevel[] = []

		if(dataUser == null) return sentMessage.localesError("userNeedsToBeLoggedIn")
		if(!isSaved(dataUser)) return sentMessage.localesError("accountDoesntSavePlays")
		
		const snipedDataUserName = message.options.getString("player")

		if(!snipedDataUserName) return sentMessage.localesError("invalidUser")

		const snipedDataUser = await findDataUserInArgs(snipedDataUserName, sentMessage)
		
		if(snipedDataUser == null) return
		
		const beforePipeline: PipelineStage[] = [{
			"$match": {
				"leaderboard.0.playerID": snipedDataUser.scoresaberID
			}
		}]

		const getDateOfPlay = {
			$addFields: {
				playDate: "$leaderboard.0.date"
			}
		}

		const [pipeline, error] = applyStandardFiltersInteraction(message, getDateOfPlay, beforePipeline)
		
		if(error) return sentMessage.localesError(error)
		
		maps = await levelSchema.aggregate(pipeline)

		if(maps == null || maps[0] == null) return sentMessage.localesError("unexpectedError")

		const snipedUserName = snipedDataUser["scoresaberName"]
		const snipedUserID = snipedDataUser["scoresaberID"]
		
		addSearch(sentMessage.author.id, "dataUser", { name: snipedUserName, value: snipedUserID })
	
		const profilePicture = await getProfilePicture(snipedUserID)
		const profilePictureBase64 = await URLtoBase64(profilePicture)
		
		sendPlaylist(maps, sentMessage, `${snipedUserName} Top 1`, `${snipedUserName}top1.json`, profilePictureBase64)
	},
}

export default command