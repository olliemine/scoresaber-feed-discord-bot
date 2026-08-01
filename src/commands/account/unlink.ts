import { SlashCommandBuilder } from "discord.js"
import getLanguage from "../../languages/lang.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getDataUserFromDiscordUser, isVisitor } from "../../discord/account/userFunctions.js"
import { visitorLogoutHandler } from "../../discord/account/visitorManager.js"
import { logoutHandler } from "../../discord/account/logout.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name: "unlink",
	category: "User",
	categoryLocale: "userCategory",
	description: getLanguage.getDefault("logoutDescription"),
	descriptionLocale: "logoutDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 5,
	slashCommand: new SlashCommandBuilder()
	.setName("unlink")
	.setDescription(getLanguage.getDefault("logoutDescription"))
	.setDescriptionLocalizations(getLanguage.getLocalizations("logoutDescription")),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const dataUser = await getDataUserFromDiscordUser(sentMessage.author)

		if(!dataUser && (await isVisitor(sentMessage.author))) return visitorLogoutHandler(sentMessage)
				
		if(!dataUser) return sentMessage.localesError("userYourNotFound")

		logoutHandler(dataUser, sentMessage)
	},
}

export default command