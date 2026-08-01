import { SlashCommandBuilder } from "discord.js"
import getLanguage from "../../languages/lang.js"
import { BotCommand } from "../../commandGetter.js"
import { getDataUserFromDiscordUser } from "../../discord/account/userFunctions.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { InteractionUserUpdateHandler, UpdateOrchestrator } from "../../update/orchestrator.js"

const command: BotCommand = {
	name: "update",
	category: "User",
	categoryLocale: "userCategory",
	description: getLanguage.getDefault("updateDescription"),
	descriptionLocale: "updateDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 5,
	slashCommand: new SlashCommandBuilder()
	.setName("update")
	.setDescription(getLanguage.getDefault("updateDescription"))
	.setDescriptionLocalizations(getLanguage.getLocalizations("updateDescription")),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const dataUser = await getDataUserFromDiscordUser(sentMessage.author)
	
		if(!dataUser) return sentMessage.localesError("userYourNotFound")

		UpdateOrchestrator.runSingle(dataUser, sentMessage.getLocalization, new InteractionUserUpdateHandler(sentMessage))
	}
}

export default command