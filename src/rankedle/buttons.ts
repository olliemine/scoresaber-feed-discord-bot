import { ButtonInteraction } from "discord.js"
import { DiscordVariables } from "../classes/sentMessageHandler.js"
import getLanguage from "../languages/lang.js"
import * as embeds from "./embeds.js"
import * as gameState from "./gameState.js"
import * as leaderboard from "./leaderboard.js"
import { announcePlayerChange, applyVoteskip, fetchGameChannel } from "./roundRunner.js"
import { joinError, voteskipError } from "./validation.js"

const localization = getLanguage.getDefault

async function reply(interaction: ButtonInteraction, content: string) {
	await interaction.reply({ content, ephemeral: true })
}

async function handleJoin(interaction: ButtonInteraction) {
	const error = joinError(interaction.user.id, interaction.channelId)

	if(error) return await reply(interaction, localization(error))

	gameState.addPlayer(interaction.user)

	await reply(interaction, localization("rankedleJoined"))
	await announcePlayerChange(interaction.user.id, "rankedleJoinedAnnouncement", DiscordVariables.SUCCESS_COLOR)
}

async function handleVoteskip(interaction: ButtonInteraction) {
	const error = voteskipError(interaction.user.id, interaction.channelId)

	if(error) return await reply(interaction, localization(error))

	gameState.addVoteskip(interaction.user.id)

	const { votes, required } = gameState.getVoteskip()

	await reply(interaction, `${localization("rankedleVoteRegistered")} (${votes}/${required})`)

	const channel = await fetchGameChannel(gameState.getChannelId())

	if(channel) await applyVoteskip(channel)
}

async function handleLeaderboardPage(interaction: ButtonInteraction) {
	const page = Number(interaction.customId.slice(`${embeds.RANKEDLE_LEADERBOARD_BUTTON}_`.length))
	const totalPages = leaderboard.getTotalPages(leaderboard.LEADERBOARD_PAGE_SIZE)

	if(!Number.isInteger(page) || page < 1 || page > totalPages) {
		return await reply(interaction, `${localization("rankedleInvalidPage")} ${totalPages}`)
	}

	await interaction.update({
		embeds: [embeds.leaderboardPageEmbed(
			localization,
			leaderboard.getPage(page, leaderboard.LEADERBOARD_PAGE_SIZE),
			page,
			leaderboard.LEADERBOARD_PAGE_SIZE,
			totalPages
		)],
		components: embeds.leaderboardRows(localization, page, totalPages)
	})
}

export async function handleRankedleButton(interaction: ButtonInteraction) {
	if(interaction.customId === embeds.RANKEDLE_JOIN_BUTTON) return await handleJoin(interaction)
	if(interaction.customId === embeds.RANKEDLE_VOTESKIP_BUTTON) return await handleVoteskip(interaction)
	if(interaction.customId.startsWith(embeds.RANKEDLE_LEADERBOARD_BUTTON)) return await handleLeaderboardPage(interaction)
}
