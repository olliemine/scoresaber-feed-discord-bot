import { ChatInputCommandInteraction, InteractionEditReplyOptions, InteractionReplyOptions, Message, MessageCreateOptions } from "discord.js"

export async function sendDiscordMessage(options: MessageCreateOptions, sendformat: Message): Promise<Message>
export async function sendDiscordMessage(options: InteractionReplyOptions, sendformat: ChatInputCommandInteraction): Promise<Message>
export async function sendDiscordMessage(options: MessageCreateOptions | InteractionReplyOptions, sendformat: ChatInputCommandInteraction | Message): Promise<Message> {
	if(sendformat instanceof ChatInputCommandInteraction) {
		if(sendformat.deferred || sendformat.replied) return await sendformat.editReply(options as InteractionEditReplyOptions)

		await sendformat.reply(options as InteractionReplyOptions)

		return await sendformat.fetchReply()
	}

	return await sendformat.reply(options as MessageCreateOptions)
}
