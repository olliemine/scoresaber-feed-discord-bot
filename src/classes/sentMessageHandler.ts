import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ColorResolvable, Colors, ComponentType, EmbedBuilder, EmbedData, InteractionReplyOptions, InteractionUpdateOptions, Message, MessageCreateOptions, MessageEditOptions, resolveColor, User } from "discord.js"
import getLanguage, { languageString, localizationFunction } from "../languages/lang.js"
import { sendDiscordMessage } from "../discord/message/interactionMessageHandler.js"
import { UPDATE_STATUS } from "../types/util.js"
import getConfig from "../config/getConfig.js"

export type ReplyOptions<T extends CommandMessage> = T extends ChatInputCommandInteraction ? InteractionReplyOptions : MessageCreateOptions 
export type CommandMessage = ChatInputCommandInteraction | Message
export type EmbedOptions = Omit<EmbedData, "color" | "thumbnail"> & {
	color?: ColorResolvable
	thumbnail?: { url?: string | null } | null
}

function toEmbedData(options: EmbedOptions = {}): EmbedData {
	const { color, thumbnail, ...rest } = options
	const embedData: EmbedData = { ...rest }

	if(color != null) embedData.color = resolveColor(color)
	if(thumbnail?.url) embedData.thumbnail = { url: thumbnail.url }

	return embedData
}

export namespace DiscordVariables {
	export const SUCCESS_COLOR = Colors.Green
	export const ERROR_COLOR = Colors.Red
	export const DEFAULT_COLOR = Colors.Greyple
	export const WARNING_COLOR = Colors.Yellow

	export const LOADING_EMOJI = getConfig().loadingEmoji ?? ""
	export const SCORESABER_EMOJI = getConfig().scoresaberEmoji ?? ""
	export const BEATSAVER_EMOJI = getConfig().beatsaverEmoji ?? ""

	export const UPDATE_STATUS_COLOR_TABLE: {[k in UPDATE_STATUS]: ColorResolvable} = {
		[UPDATE_STATUS.ERROR]: DiscordVariables.ERROR_COLOR,
		[UPDATE_STATUS.NO_UPDATE]: DiscordVariables.DEFAULT_COLOR,
		[UPDATE_STATUS.SUCCESS]: DiscordVariables.SUCCESS_COLOR,
		[UPDATE_STATUS.PARTIAL_SUCCESS]: DiscordVariables.WARNING_COLOR
	}
}

export default class SentMessageHandler<T extends CommandMessage = CommandMessage> {
	public respondingMessage: T
	public hasBeenSent: boolean = false
	public message: Message | null = null
	public author: User

	private embeds: EmbedBuilder[] = []
	private embedIndex: number = 0

	constructor(respondingMessage: T) {
		this.respondingMessage = respondingMessage
		this.author = respondingMessage instanceof ChatInputCommandInteraction ? respondingMessage.user : respondingMessage.author
		return this
	}

	getLocalization: localizationFunction = (languageString?: languageString) => {				
		if(!languageString) return ""
		
		if(this.respondingMessage instanceof Message) {
			return getLanguage.getDefault(languageString)
		}

		return getLanguage.getString(this.respondingMessage?.locale, languageString)
	}

	private async _send(options: ReplyOptions<T>) {
		let sentMessage: Message
		
		if(this.respondingMessage instanceof ChatInputCommandInteraction) sentMessage = await sendDiscordMessage(options as InteractionReplyOptions, this.respondingMessage)
		else sentMessage = await sendDiscordMessage(options as MessageCreateOptions, this.respondingMessage)
		
		this.message = sentMessage
		
		this.hasBeenSent = true
		
		return this
	}

	private async _edit(options: MessageEditOptions) {
		if(this.message) await this.message.edit(options)
		return this
	}

	async postOptions(options: ReplyOptions<T>) {
		if(this.hasBeenSent) return await this._edit(options as MessageEditOptions)
		return await this._send(options)
	}

	async postEmbed(embed: EmbedBuilder) {
		this.embeds[this.embedIndex] = embed
		return await this.postOptions({ embeds: this.embeds, components: [], content: undefined })
	}


	async localesLoading(localMessage: languageString = "loading") {
		const options: EmbedOptions = {}
		
		options.description = `${this.getLocalization(localMessage)}... ${DiscordVariables.LOADING_EMOJI}`

		return await this.loading(options)
	}

	static createLoading(options: EmbedOptions = {}): EmbedData {
		if(!options.description) options.description = `${getLanguage.getDefault("loading")}... ${DiscordVariables.LOADING_EMOJI}`
		
		options.color = DiscordVariables.DEFAULT_COLOR
		
		return toEmbedData(options)
	}

	async loading(options: EmbedOptions = {}) {
		return await this.postEmbed(new EmbedBuilder(SentMessageHandler.createLoading(options)))
	}
	
	async localesError(localMessage?: languageString, localTitle: languageString = "errorTitle", thumbnail?: string) {
		const options: EmbedOptions = {}
		
		if(localMessage) options.description = this.getLocalization(localMessage)

		if(localTitle) options.title = this.getLocalization(localTitle)

		if(thumbnail) options.thumbnail = { url: thumbnail }

		return await this.error(options)
	}

	async localesSuccess(localMessage?: languageString, localTitle: languageString = "successTitle", thumbnail?: string) {
		const options: EmbedOptions = {}
		
		if(localMessage) options.description = this.getLocalization(localMessage)

		if(localTitle) options.title = this.getLocalization(localTitle)

		if(thumbnail) options.thumbnail = { url: thumbnail }

		return await this.success(options)
	}

	async localesNormal(localMessage?: languageString, localTitle?: languageString, thumbnail?: string, color?: ColorResolvable) {
		const options: EmbedOptions = {}
		
		if(localMessage) options.description = this.getLocalization(localMessage)

		if(localTitle) options.title = this.getLocalization(localTitle)

		if(thumbnail) options.thumbnail = { url: thumbnail }

		if(color) options.color = color

		return await this.normal(options)
	}

	static createError(options: EmbedOptions = {}): EmbedData {
		if(!options.title) options.title = getLanguage.getDefault("errorTitle")
		
		options.color = DiscordVariables.ERROR_COLOR

		return toEmbedData(options)
	}

	async error(options: EmbedOptions = {}) {
		return await this.postEmbed(new EmbedBuilder(SentMessageHandler.createError(options)))
	}

	static createSuccess(options: EmbedOptions = {}): EmbedData {
		if(!options.title) options.title = getLanguage.getDefault("successTitle")
		
		options.color = DiscordVariables.SUCCESS_COLOR

		return toEmbedData(options)
	}

	async success(options: EmbedOptions = {}) {
		return await this.postEmbed(new EmbedBuilder(SentMessageHandler.createSuccess(options)))
	}

	async normal(options: EmbedOptions = {}): Promise<this> {	
		return await this.postEmbed(new EmbedBuilder(toEmbedData(options)))
	}

	async simplePageMenu(pages: ReplyOptions<T>[], { time = 120, stopButton = true, endPrompt = "Closed.", onlyAuthor = false } = {}) {
		if(!this.message) throw new Error("Message wasn't sent first")
		
		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setCustomId("back")
					.setLabel("←")
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId("forward")
					.setLabel("→")
					.setStyle(ButtonStyle.Primary),
			)
		
		if(stopButton) row.addComponents(
			new ButtonBuilder()
				.setCustomId("stop")
				.setLabel("Stop")
				.setStyle(ButtonStyle.Danger)
		)

		let page = 0
		
		pages.forEach(page => page.components = [row])
		await this.postOptions(pages[page])
		const buttoncollector = this.message.createMessageComponentCollector({ componentType: ComponentType.Button, time: (1000 * time) })
		
		buttoncollector.on("collect", async (i) => {
			if(onlyAuthor && i.user.id !== this.author.id) return 
			
			switch (i.customId) {
				case "back":
					if(page === 0) page = pages.length - 1
					else page--
					i.update(pages[page] as InteractionUpdateOptions)
					break
				case "forward":
					if(page === pages.length - 1) page = 0
					else page++
					i.update(pages[page] as InteractionUpdateOptions)
					break
				case "stop":
					buttoncollector.stop()
			}
		})

		buttoncollector.once("end", () => {
			if(!endPrompt) return

			if(typeof endPrompt === "string") {
				this.postOptions({ embeds: [], components: [], content: endPrompt })
				return
			}

			this.postOptions(endPrompt)
		})
	}

	async successWarningHandler(
		warnings: string | null | undefined,
		success: string,
		titleLocale: languageString = "successTitle",
		thumbnail?: string
	) {
		if(warnings == null){
			return this.success({
				description: success,
				title: this.getLocalization(titleLocale),
				...(thumbnail ? { thumbnail: { url: thumbnail } } : {})
			})
		}
	
		return this.normal({
			description: `${success}\n\n**Warnings**:\n${warnings}`,
			title: this.getLocalization(titleLocale),
			...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
			color: DiscordVariables.WARNING_COLOR
		})
	}

	public nextEmbed() {
		if(!this.embeds[this.embedIndex]) throw new Error(`Index ${this.embedIndex} is not yet filled`)
		
		if(this.embedsAmount === 10) throw new Error(`Max embed count achieved`)
		
		this.embedIndex++
		return this
	}

	get embedsAmount() {
		return this.embedIndex + 1
	}
}
