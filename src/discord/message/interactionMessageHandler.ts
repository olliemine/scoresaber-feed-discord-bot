import { ChatInputCommandInteraction, InteractionReplyOptions, Message, MessageCreateOptions } from "discord.js"

export async function sendDiscordMessage(options: MessageCreateOptions, sendformat: Message): Promise<Message> 
export async function sendDiscordMessage(options: InteractionReplyOptions, sendformat: ChatInputCommandInteraction): Promise<Message> 
export async function sendDiscordMessage(options: MessageCreateOptions | InteractionReplyOptions, sendformat: ChatInputCommandInteraction | Message): Promise<Message> {	
	if(sendformat instanceof ChatInputCommandInteraction) {
		const interactionOptions: InteractionReplyOptions & { fetchReply: true } = {
			...options as InteractionReplyOptions,
			fetchReply: true,
		};
	
		return await sendformat.reply(interactionOptions) as Message
	}

	return await sendformat.reply(options as MessageCreateOptions)
}
