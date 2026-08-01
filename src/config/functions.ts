import { AttachmentBuilder, ChannelType, Routes, TextChannel } from "discord.js";
import { slashCommands } from "../commandGetter.js";
import appContext from "../index.js";
import { logger } from "../logger.js";
import getConfig from "./getConfig.js";
import getLanguage from "../languages/lang.js";

export let configVars = {
	verificationChannel: false
}

export async function refreshSlashCommands() {
	if(!slashCommands.length) throw new Error("Slash commands havent loaded in yet.")
	if(!appContext.rest) throw new Error(`Rest not defined`)
	if(appContext.discordClient == null || appContext.discordClient.user == null) throw new Error("DiscordClient not defined")

	try {
		await appContext.rest.put(
			Routes.applicationGuildCommands(appContext.discordClient.user.id, getConfig()["server-id"]),
			{ body: slashCommands },
		);

		logger.configuration('Successfully reloaded application (/) commands.');
		return
	} catch (error) {
		logger.error(error + " This error was executed by an automatic configuration update, if this keeps happening please try disabling automatic configuration")
		throw error
	}
}

export async function verificationChannelRefresh() {
	if(!appContext.server) throw new Error(`Server is not defined`)
	if(!getConfig().database["user-login"].VerificationChannel.enabled) return
	
	const channel = appContext.server.channels.cache.get(getConfig().database["user-login"].VerificationChannel.id ?? "")
	
	if(!channel || channel.type !== ChannelType.GuildText) {
		logger.error("Couldn't find verification channel, turning off feature. Please verify that you have the correct channel id and restart the bot.")
		return
	}
	
	if(getConfig().database["user-login"].VerificationChannel.haveInstructionMessage === false) return

	const attachment = new AttachmentBuilder("https://media.discordapp.net/attachments/905874757357043756/907344766960820234/unknown.png")

	const message = await (channel as TextChannel).send({content: getLanguage.getDefault("verificationChannelMessage"), files: [attachment]})
	return message.id
}

export default async function defaultConfigurationRefresh() {
	await refreshSlashCommands()
	await verificationChannelRefresh()
}
