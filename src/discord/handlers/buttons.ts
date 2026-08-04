import { ButtonInteraction } from "discord.js"
import { logger } from "../../logger.js"
import { handleRankedleButton } from "../../rankedle/buttons.js"
import { RANKEDLE_JOIN_BUTTON, RANKEDLE_LEADERBOARD_BUTTON, RANKEDLE_VOTESKIP_BUTTON } from "../../rankedle/embeds.js"

const HANDLERS: { prefixes: string[], handle: (interaction: ButtonInteraction) => Promise<void> }[] = [{
	prefixes: [RANKEDLE_JOIN_BUTTON, RANKEDLE_VOTESKIP_BUTTON, RANKEDLE_LEADERBOARD_BUTTON],
	handle: handleRankedleButton
}]

export async function buttonHandler(interaction: ButtonInteraction) {
	const handler = HANDLERS.find(handler => handler.prefixes.some(prefix => interaction.customId.startsWith(prefix)))

	if(!handler) return

	try {
		await handler.handle(interaction)
	} catch(err) {
		logger.unknownError(err)
	}
}
