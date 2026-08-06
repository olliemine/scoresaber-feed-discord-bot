import { SlashCommandBuilder, ChannelType } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { unexpectedErrorInteractionHandler } from "../../discord/message/interactions.js"
import { logger } from "../../logger.js"
import { getEnabledFeedStrings } from "../../testfeed/feedCatalog.js"
import { runTestFeed } from "../../testfeed/runTestFeed.js"

const command: BotCommand = {
	name: "testfeed",
	category: "Master",
	description: "Preview an enabled feed message using live ScoreSaber data.",
	level: COMMAND_PERMISSIONS.MASTER,
	cooldown: -1,
	slashCommand: new SlashCommandBuilder()
		.setName("testfeed")
		.setDescription("Preview an enabled feed message using live ScoreSaber data.")
		.addStringOption(option => option
			.setName("feed")
			.setDescription("Enabled feed event (e.g. Top1MainCountries)")
			.setRequired(true)
			.setAutocomplete(true))
		.addIntegerOption(option => option
			.setName("score_id")
			.setDescription("Optional ScoreSaber score ID (map feeds only)")
			.setRequired(false)),
	autocomplete: async (interaction) => {
		const focused = interaction.options.getFocused().toLowerCase()
		const choices = getEnabledFeedStrings()
			.filter(feed => feed.toLowerCase().includes(focused))
			.slice(0, 25)
			.map(feed => ({ name: feed, value: feed }))

		await interaction.respond(choices)
	},
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).loading({ description: "Building test feed..." })

		if(!message.channel || message.channel.type !== ChannelType.GuildText) {
			return sentMessage.error({ description: "Run this command in a text channel." })
		}

		const feed = message.options.getString("feed", true)
		const scoreId = message.options.getInteger("score_id") ?? undefined

		try {
			await runTestFeed(feed, message.channelId, scoreId ?? undefined)
			await sentMessage.success({ description: `Posted test feed **${feed}** in this channel.` })
		} catch(err) {
			logger.unknownError(err)
			unexpectedErrorInteractionHandler(err, sentMessage)
		}
	}
}

export default command
