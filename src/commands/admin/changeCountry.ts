import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import userSchema from "../../models/userSchema.js"
import { changeCountry } from "../../discord/account/userFunctions.js"
import { getProfilePicture } from "../../scoresaber/player/playerFunctions.js"
import { unexpectedErrorInteractionHandler } from "../../discord/message/interactions.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { logger } from "../../logger.js"

const command: BotCommand = {
	name: "changecountry",
	category: "Admin",
	description: "Makes user another country",
	level: COMMAND_PERMISSIONS.ADMIN,
	cooldown: 3,
	slashCommand: new SlashCommandBuilder()
	.setName("changecountry")
	.setDescription("Makes user another country")
	.addUserOption(option => option.setName("discord_user")
		.setDescription("Discord user which will be logged in")
		.setRequired(true))
	.addStringOption(option => option.setName("country")
		.setDescription("New country of the user")
		.setMinLength(2)
		.setMaxLength(2)
		.setRequired(true)),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		
		try {
			const country = message.options.getString("country")
	
			const discordUser = message.options.getUser("discord_user")
	
			if(!country || !discordUser) return sentMessage.localesError("invalidString")
	
			const dataUser = (await userSchema.findOne({ discordID: discordUser.id }))?.toObject()
			
			if(dataUser == null) return sentMessage.localesError("invalidUser")
			
			await changeCountry(dataUser, country)
			const profilePicture = await getProfilePicture(dataUser["scoresaberID"])
				
			sentMessage.success({
				description: `Changed country of ${dataUser["scoresaberName"]} to ${country.toUpperCase()}`,
				...(profilePicture ? { thumbnail: { url: profilePicture } } : {})
			})	
		} catch(err) {
			logger.unknownError(err)
			unexpectedErrorInteractionHandler(err, sentMessage)
		}
	},
}

export default command