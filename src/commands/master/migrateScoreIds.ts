import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler, { DiscordVariables } from "../../classes/sentMessageHandler.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { unexpectedErrorInteractionHandler } from "../../discord/message/interactions.js"
import { logger } from "../../logger.js"
import { migrateScoreIds } from "../../scoresaber/handlers/migrateScoreIds.js"

const command: BotCommand = {
	name: "migratescoreids",
	category: "Master",
	description: "Backfill ScoreSaber score IDs on stored leaderboard entries.",
	level: COMMAND_PERMISSIONS.MASTER,
	cooldown: -1,
	slashCommand: new SlashCommandBuilder()
		.setName("migratescoreids")
		.setDescription("Backfill ScoreSaber score IDs on stored leaderboard entries."),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).loading({
			description: `Starting score ID migration... ${DiscordVariables.LOADING_EMOJI}`
		})

		try {
			const result = await migrateScoreIds(async (progress) => {
				await sentMessage.loading({ description: `${progress} ${DiscordVariables.LOADING_EMOJI}` })
			})

			await sentMessage.success({
				description: [
					"Score ID migration finished.",
					`Players processed: ${result.playersProcessed}`,
					`Already had ID: ${result.alreadyHadId}`,
					`Matched: ${result.matched}`,
					`Unmatched: ${result.unmatched}`,
					`Documents updated: ${result.updated}`
				].join("\n")
			})
		} catch(err) {
			logger.unknownError(err)
			unexpectedErrorInteractionHandler(err, sentMessage)
		}
	}
}

export default command
