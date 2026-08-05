import { decodeStringAsync, regexLexicon } from "../../regex/regexLexicon.js"
import { DefaultChannelFeedConfiguration, RegexMessage } from "../../types/config.js"
import { ActionRowBuilder, ButtonBuilder, ChannelType, ColorResolvable, EmbedBuilder } from "discord.js"
import { getColorPaletteFromURL, resolveLegacyColor } from "../../misc/util.js"
import getConfig from "../../config/getConfig.js"
import appContext from "../../index.js"
import { EventRegexes } from "../../regex/feedEventHandler.js"
import { PromiseOrNot } from "../../types/util.js"

export type embedDecodeFunction<T = any> = (value: string, args: T) => PromiseOrNot<string>
export type embedButton<T = any> = {
	name: string,
	create: (args: T) => PromiseOrNot<ButtonBuilder | null>
}

interface getRegexMessageOptions {
	embedButtons?: embedButton[],
	embedDecodePicture?: embedDecodeFunction,
	embedDecodeURL?: embedDecodeFunction,
}

async function getButtons(embedButtons: embedButton[] | undefined, message: RegexMessage, args: any) {
	if(embedButtons && message.buttons) {
		let buttons = []

		for await(const buttonName of message.buttons) {
			const buttonData = embedButtons.find(b => b.name.toLowerCase() === buttonName.toLowerCase())
			if(!buttonData) continue
			
			const button = await buttonData.create(args)
			if(!button) continue
			buttons.push(button)
		}

		if(buttons[0]) return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)]
	}

	return null
}

export async function getRegexMessage(
	message: RegexMessage,
	regexLexicon: regexLexicon | {[key: string]: regexLexicon},
	args: any,
	stringToDecoded: embedDecodeFunction,
	{
		embedButtons = undefined,
		embedDecodePicture = undefined,
		embedDecodeURL = undefined,
	}: getRegexMessageOptions
): Promise<{ content: string, components?: ActionRowBuilder<ButtonBuilder>[] } | { embeds: EmbedBuilder[], components?: ActionRowBuilder<ButtonBuilder>[] }> {	
	const decodeStringOptions = { removeSlashOption: true }

	const decodeStringArgumentBuilder = async (string: string, regexLexiconVar: regexLexicon) => 
	await decodeStringAsync(string, regexLexiconVar, stringToDecoded, args, decodeStringOptions)

	if(message.type === "message") {		
		const string = await decodeStringArgumentBuilder(message.message, regexLexicon as regexLexicon)
		
		const messageObject: { content: string, components?: ActionRowBuilder<ButtonBuilder>[] } = { content: string }
		
		const row = await getButtons(embedButtons, message, args)

		if(row) messageObject.components = row

		return messageObject
	}

	const embed = new EmbedBuilder()
	
	if(message.embedTitle) {
		const embedTitle = await decodeStringArgumentBuilder(message.embedTitle, (regexLexicon as {[key: string]: regexLexicon}).embedTitle)
		embed.setTitle(embedTitle)
	}

	if(message.embedDescription) {
		const embedDescription = await decodeStringArgumentBuilder(message.embedDescription, (regexLexicon as {[key: string]: regexLexicon}).embedDescription)
		embed.setDescription(embedDescription)
	}

	if(embedDecodeURL && message.embedURL) {
		const embedURL = await embedDecodeURL(message.embedURL, args)
		if(embedURL) embed.setURL(embedURL)
	}

	if(message.embedFields) {
		for (let i = 1; i < Object.keys(message.embedFields).length + 1; i++) {
			if(message.embedFields[i.toString()][3]) {
				const str = await stringToDecoded(message.embedFields[i.toString()][3], args)
				if(!str) continue
			}
			
			const embedfieldName = await decodeStringArgumentBuilder(message.embedFields[i.toString()][0], (regexLexicon as {[key: string]: regexLexicon})[`embedFields_${i}_0`])
			const embedfieldDescription = await decodeStringArgumentBuilder(message.embedFields[i.toString()][1], (regexLexicon as {[key: string]: regexLexicon})[`embedFields_${i}_1`])
			const embedfieldOption = message.embedFields[i.toString()][2] || false
			
			embed.addFields([{
				name: embedfieldName,
				value: embedfieldDescription,
				inline: embedfieldOption
			}])
		}
	}

	const row = await getButtons(embedButtons, message, args)
	
	if(embedDecodePicture) {	
		if(message.embedThumbnail && message.embedThumbnail !== "none") {
			const pictureURL = await embedDecodePicture(message.embedThumbnail, args)
			if(pictureURL != null) embed.setThumbnail(pictureURL)
		}

		if(message.embedImage && message.embedImage !== "none") {
			const pictureURL = await embedDecodePicture(message.embedImage, args)
			if(pictureURL != null) embed.setImage(pictureURL)
		}
	}

	if(message.embedColor && message.embedColor.value !== "none") {
		switch(message.embedColor.type) {
			case "image":
				if(!embedDecodePicture) break
				const pictureURL = await embedDecodePicture(message.embedColor.value, args)
				if(pictureURL == null) break

				const palette = await getColorPaletteFromURL(pictureURL).catch(() => {})

				if(palette?.Vibrant?.hex) embed.setColor(palette.Vibrant.hex as ColorResolvable)
				break
			case "color":
				const resolvedColor = resolveLegacyColor(message.embedColor.value)
				if(resolvedColor != null) embed.setColor(resolvedColor)
				break
		}
	}

	const messageObject: { embeds: EmbedBuilder[], components?: ActionRowBuilder<ButtonBuilder>[] } = { embeds: [embed] }
	
	if(row) messageObject.components = row
	
	return messageObject
}

export async function postFeed<T>(
	channelConfiguration: DefaultChannelFeedConfiguration,
	event: string,
	feedMessages: {[key: string]: RegexMessage},
	eventData: EventRegexes,
	decodeStringArguments: T,
	stringToDecoded: embedDecodeFunction<T>,
	options: getRegexMessageOptions
) {	
	const channel = appContext.server?.channels.cache.get(channelConfiguration.Channel)
	
	if(!channel) throw new Error(`Discord Channel (${channelConfiguration.Channel}) was not found in server ${getConfig()["server-id"]}`)
	
	const feedMessageProperty = eventData.events[event].getFeedMessageProperty()
	const feedMessage = feedMessages[feedMessageProperty]
	const regexLexicon = eventData.regexLexicon[feedMessageProperty]

	const messageObject = await getRegexMessage(feedMessage, regexLexicon, decodeStringArguments, stringToDecoded, options)

	if(channel.type !== ChannelType.GuildText) throw new Error(`Discord Channel (${channelConfiguration.Channel}) is not a GUILD_TEXT`)
	
	return await channel.send(messageObject)
}
