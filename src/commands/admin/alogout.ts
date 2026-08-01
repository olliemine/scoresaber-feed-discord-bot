import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getDataUserFromDiscordUser, isVisitor } from "../../discord/account/userFunctions.js"
import { adminVisitorLogoutHandler } from "../../discord/account/visitorManager.js"
import { adminLogoutHandler } from "../../discord/account/logout.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name: "alogout",
	category: "Admin",
	description: "Force a logout on a user",
	level: COMMAND_PERMISSIONS.ADMIN,
	cooldown: 5,
	slashCommand: new SlashCommandBuilder()
	.setName("alogout")
	.setDescription("Force a logout on a user")
	.addUserOption(option => option.setName("discord_user")
		.setDescription("Discord user which will be logged out")
		.setRequired(true)),
	async execute(message) {
		const discordUser = message.options.getUser("discord_user")

		const sentMessage = await new SentMessageHandler(message).localesLoading()

		if(!discordUser) return new SentMessageHandler(message).localesError("invalidString")
		
		const dataUser = await getDataUserFromDiscordUser(discordUser)

		if(!dataUser && (await isVisitor(discordUser))) return adminVisitorLogoutHandler(sentMessage, discordUser)
				
		if(!dataUser) return sentMessage.localesError("userYourNotFound")

		adminLogoutHandler(dataUser, sentMessage)
	},
}

export default command