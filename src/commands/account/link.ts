import { SlashCommandBuilder } from "discord.js"
import getLanguage from "../../languages/lang.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { BaseLoginInteractionHandler, interactionLogin } from "../../discord/account/login.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name: "link",
	category: "User",
	categoryLocale: "userCategory",
	description: getLanguage.getDefault("linkDescription"),
	descriptionLocale: "linkDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 5,
	slashCommand: new SlashCommandBuilder()
	.setName("link")
	.setDescription(getLanguage.getDefault("linkDescription")).setDescriptionLocalizations(getLanguage.getLocalizations("linkDescription"))
	.addStringOption(option => option.setName("scoresaber_player")
		.setDescription(getLanguage.getDefault("scoresaberPlayerDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("scoresaberPlayerDescription"))
		.setRequired(true)),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()

		const scoresaberPlayer = message.options.getString("scoresaber_player")
		
		if(!scoresaberPlayer) return sentMessage.localesError("invalidString")

		await interactionLogin(scoresaberPlayer, message.user, new BaseLoginInteractionHandler(sentMessage))
	},
}

export default command