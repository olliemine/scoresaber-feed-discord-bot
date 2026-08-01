import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import getLanguage from "../../languages/lang.js"
import { mapTagAutocomplete } from "../../discord/autocomplete/functions.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getDataUserFromDiscordUser, isSaved } from "../../discord/account/userFunctions.js"
import { PipelineStage } from "mongoose"
import { applyStandardFiltersInteraction, applyStandardFiltersOptions, playlistAutocompleteHandler, sendPlaylist } from "../../playlists/discordHandler.js"
import { addSearch } from "../../discord/autocomplete/cache.js"
import levelSchema from "../../models/levelSchema.js"
import { getProfilePicture } from "../../scoresaber/player/playerFunctions.js"
import { PlaylistLevel, URLtoBase64 } from "../../playlists/generatePlaylist.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name : "top1serverplaylist",
	category: "Playlist",
	description: getLanguage.getDefault("playlistTop1ServerDescription"),
	descriptionLocale: "playlistTop1ServerDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 10,
	slashCommand: applyStandardFiltersOptions(new SlashCommandBuilder()
		.setName("top1serverplaylist")
		.setDescription(getLanguage.getDefault("playlistTop1ServerDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("playlistTop1ServerDescription"))),
	autocomplete: playlistAutocompleteHandler,
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const dataUser = await getDataUserFromDiscordUser(message.user)
		let maps: PlaylistLevel[] = []

		if(dataUser == null) return sentMessage.localesError("userNeedsToBeLoggedIn")
		if(!isSaved(dataUser)) return sentMessage.localesError("accountDoesntSavePlays")
		
		const beforePipeline: PipelineStage[] = [{
			$match: {
				"leaderboard.0.playerID": { $ne: dataUser.scoresaberID }
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

		addSearch(sentMessage.author.id, "dataUser", { name: dataUser["scoresaberName"], value: dataUser["scoresaberID"] })
	
		const profilePicture = await getProfilePicture(dataUser["scoresaberID"])
		const profilePictureBase64 = await URLtoBase64(profilePicture)
		
		sendPlaylist(maps, sentMessage, `Server Top 1`, `servertop1.json`, profilePictureBase64)
	},
}

export default command