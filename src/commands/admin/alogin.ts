import { SlashCommandBuilder } from "discord.js"
import getLanguage from "../../languages/lang.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { AdminLoginInteractionHandler, interactionLogin } from "../../discord/account/login.js"

const command: BotCommand = {
	name: "alink",
	category: "Admin",
	description: "Force a login on a user",
	level: COMMAND_PERMISSIONS.ADMIN,
	cooldown: 5,
	slashCommand: new SlashCommandBuilder()
	.setName("alink")
	.setDescription("Force a login on a user")
	.addUserOption(option => option.setName("discord_user")
		.setDescription("Discord user which will be logged in")
		.setRequired(true))
	.addStringOption(option => option.setName("scoresaber_player")
		.setDescription(getLanguage.getDefault("scoresaberPlayerDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("scoresaberPlayerDescription"))
		.setRequired(true)),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()

		const discordUser = message.options.getUser("discord_user")

		const scoresaberPlayer = message.options.getString("scoresaber_player")
		
		if(!scoresaberPlayer || !discordUser) return sentMessage.localesError("invalidString")

		await interactionLogin(scoresaberPlayer, discordUser, new AdminLoginInteractionHandler(sentMessage))
	},
}

export default command