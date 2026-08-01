import { AttachmentBuilder, AutocompleteInteraction, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js"
import { PipelineStage } from "mongoose"
import { getMapTag } from "../discord/handlers/messageArguments.js"
import { addSearch } from "../discord/autocomplete/cache.js"
import { filterPipeline, PlaylistFilters } from "./filter.js"
import SentMessageHandler, { CommandMessage } from "../classes/sentMessageHandler.js"
import { PlaylistLevel, generatePlaylist } from "./generatePlaylist.js"
import getLanguage, { languageString } from "../languages/lang.js"
import { dataUserAutocomplete, mapTagAutocomplete } from "../discord/autocomplete/functions.js"

export function getStandardFiltersInteraction(
	interaction: ChatInputCommandInteraction
): [PlaylistFilters, null] | [null, languageString] {
	const limit = interaction.options.getInteger("limit") ?? 10000
	const ranked = interaction.options.getBoolean("ranked") ?? false
	const minNPS = interaction.options.getNumber("min_nps") ?? 0
	const maxNPS = interaction.options.getNumber("max_nps") ?? 0
	const minDateString = interaction.options.getString("min_date")
	const maxDateString = interaction.options.getString("max_date")
	const minStars = interaction.options.getNumber("min_stars") ?? 0
	const maxStars = interaction.options.getNumber("max_stars") ?? 0
	const tagString = interaction.options.getString("tag") ?? ""
	
	let minDateTime: Date | null
	let maxDateTime: Date | null

	try {
		minDateTime = minDateString != null ? new Date(minDateString) : null
	} catch {
		return [null, "playlistInvalidMinDate"]
	}

	try {
		maxDateTime = maxDateString != null ? new Date(maxDateString) : null
	} catch {
		return [null, "playlistInvalidMaxDate"]
	}
	
	const tag = getMapTag(tagString)
	
	const tagValue = tag?.value ?? null

	if(tag) addSearch(interaction.user.id, "mapTag", tag)

	return [{ limit, ranked, minNPS, maxNPS, minDateTime, maxDateTime, minStars, maxStars, tag: tagValue }, null]
}

export function applyStandardFiltersInteraction(
	interaction: ChatInputCommandInteraction,
	getDateOfPlay: { $addFields: { playDate: string }},
	beforePipeline?: PipelineStage[],
	afterPipeline?: PipelineStage[]
): [null, languageString] | [PipelineStage[], null] {
	const [filters, error] = getStandardFiltersInteraction(interaction)

	if(error) return [null, error]

	return filterPipeline(filters, getDateOfPlay, beforePipeline, afterPipeline)
}

export async function sendPlaylist<T extends CommandMessage>(maps: PlaylistLevel[], sentMessage: SentMessageHandler<T>, playlistName: string, playlistFileName: string, cover: string | null) {
	try {
		const playlistData = generatePlaylist(maps, playlistName, cover)
		if(!playlistData) return sentMessage.localesError("unexpectedError")
		
		const playlistBuffer = Buffer.from(JSON.stringify(playlistData, null, 4))
		const playlistAttachment = new AttachmentBuilder(playlistBuffer, { name: playlistFileName })

		sentMessage.postOptions({ 
			embeds: [new EmbedBuilder(SentMessageHandler.createSuccess({
				description: `${sentMessage.getLocalization("playlistCreation")}, ${maps.length} ${sentMessage.getLocalization("playlistMapsFound")}.`,
				title: sentMessage.getLocalization("successTitle")
			}))], 
			files: [playlistAttachment]
		})
	} catch(err) {
		sentMessage.error({ description: `${sentMessage.getLocalization("unexpectedError")}: ${err}` })
	}
}

export function applyStandardFiltersOptions(slashCommand: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder) {
	return slashCommand
		.addIntegerOption(option => option.setName("limit")
			.setDescription(getLanguage.getDefault("playlistLimitDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistLimitDescription"))
			.setMinValue(1)
			.setMaxValue(10000))
		.addBooleanOption(option => option.setName("ranked")
			.setDescription(getLanguage.getDefault("playlistRankedDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistRankedDescription")))
		.addNumberOption(option => option.setName("min_nps")
			.setDescription(getLanguage.getDefault("playlistMinNPSDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistMinNPSDescription"))
			.setMinValue(0))
		.addNumberOption(option => option.setName("max_nps")
			.setDescription(getLanguage.getDefault("playlistMaxNPSDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistMaxNPSDescription"))
			.setMinValue(1))
		.addStringOption(option => option.setName("min_date")
			.setDescription(getLanguage.getDefault("playlistMinDateDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistMinDateDescription")))
		.addStringOption(option => option.setName("max_date")
			.setDescription(getLanguage.getDefault("playlistMaxDateDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistMaxDateDescription")))
		.addNumberOption(option => option.setName("min_stars")
			.setDescription(getLanguage.getDefault("playlistMinStarsDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistMinStarsDescription"))
			.setMinValue(0))
		.addNumberOption(option => option.setName("max_stars")
			.setDescription(getLanguage.getDefault("playlistMaxStarsDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistMaxStarsDescription"))
			.setMinValue(1))
		.addStringOption(option => option.setName("tag")
			.setDescription(getLanguage.getDefault("playlistTagDescription"))
			.setDescriptionLocalizations(getLanguage.getLocalizations("playlistTagDescription"))
			.setAutocomplete(true))
}

export function playlistAutocompleteHandler(interaction: AutocompleteInteraction) {
	const focusedOption = interaction.options.getFocused(true)
	switch (focusedOption.name) {
		case "player":
			dataUserAutocomplete(interaction)
			return
		case "tag":
			mapTagAutocomplete(interaction)
			return
	}
}