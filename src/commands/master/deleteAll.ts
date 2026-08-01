import { Colors, EmbedBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { simpleYesOrNoPrompt } from "../../discord/message/interactions.js"
import { logger } from "../../logger.js"
import userSchema from "../../models/userSchema.js"
import levelSchema from "../../models/levelSchema.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name: "deleteAll",
	category: "Master",
	description: "Deletes everything from the database.",
	level: COMMAND_PERMISSIONS.MASTER,
	cooldown: -1,
	async execute(message) {
		const sentMessage = new SentMessageHandler(message)
		
		const embed = new EmbedBuilder()
		.setColor(Colors.Red)
		.setTitle("Are you sure you want to do this?")
		.setDescription("This will delete EVERYTHING from the database, this action IS NOT reversable.")

		simpleYesOrNoPrompt({embeds: [embed]}, sentMessage, { onlyAuthor: true, time: 60 })
		.then(async () => {
			sentMessage.loading({ description: "Deleting everything... This may take a couple seconds..." })
			logger.info(`User ${sentMessage.author.username} requested for everything in the Database to be deleted. Request granted.`)
			
			await userSchema.deleteMany({})
			
			await levelSchema.deleteMany({})
			
			sentMessage.success({ description: "Deleted everything"})
		}).catch(async (res) => {
			if(res instanceof Error) return logger.error(res)
			if(!(res instanceof SentMessageHandler)) return
			
			sentMessage.normal({ description: "cool ig lol" })
		})
	},
}

export default command