import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder } from "discord.js"
import { DiscordVariables } from "../classes/sentMessageHandler.js"
import getConfig from "../config/getConfig.js"
import { localizationFunction } from "../languages/lang.js"
import { resolveLegacyColor } from "../misc/util.js"
import { RankedleLeaderboardEntry, RankedlePlayer, RankedleSong } from "../types/rankedle.js"

export const RANKEDLE_JOIN_BUTTON = "rankedle_join"
export const RANKEDLE_VOTESKIP_BUTTON = "rankedle_voteskip"
export const RANKEDLE_LEADERBOARD_BUTTON = "rankedle_leaderboard"

const MEDALS = ["🥇", "🥈", "🥉"]

const gameColor = (): ColorResolvable =>
	resolveLegacyColor(getConfig().commands.rankedle.embedColor) ?? DiscordVariables.DEFAULT_COLOR

const position = (index: number) => MEDALS[index] ?? `${index + 1}.`
const framed = (emoji: string, text: string) => `${emoji} ${text} ${emoji}`

function playerList(localization: localizationFunction, players: RankedlePlayer[]) {
	if(!players.length) return localization("rankedleNoPlayers")

	return players.map(player => `<@${player.id}> (${player.score} ${localization("rankedlePointsShort")})`).join(", ")
}

function scoreList(localization: localizationFunction, players: RankedlePlayer[]) {
	if(!players.length) return localization("rankedleNoParticipants")

	return players
		.map((player, index) => `${position(index)} <@${player.id}>: **${player.score}** ${localization("rankedlePoints")}`)
		.join("\n")
}

function globalScoreList(localization: localizationFunction, entries: RankedleLeaderboardEntry[], offset = 0) {
	if(!entries.length) return localization("rankedleEmptyPage")

	return entries
		.map((entry, index) => `${position(offset + index)} **${entry.name}**: ${entry.globalScore} ${localization("rankedlePoints")}`)
		.join("\n")
}

function songReference(localization: localizationFunction, song: RankedleSong) {
	return `${localization("rankedleSongWas")} **${song.name}** ${localization("rankedleSongBy")} **${song.songAuthor}**`
}

export function joinEmbed(localization: localizationFunction, players: RankedlePlayer[], secondsLeft: number) {
	return new EmbedBuilder()
		.setTitle(framed("🎵", localization("rankedleNewGameTitle")))
		.setColor(gameColor())
		.setDescription([
			`**${secondsLeft}** ${localization("rankedleSecondsToJoin")}`,
			`**${getConfig().commands.rankedle.maxPointsPerGame}** ${localization("rankedlePointsToWin")}`,
			`${localization("rankedlePlayers")}: ${playerList(localization, players)}`
		].join("\n\n"))
		.setFooter({ text: localization("rankedleDescription") })
}

export function gameStartedEmbed(localization: localizationFunction, players: RankedlePlayer[]) {
	return new EmbedBuilder()
		.setTitle(framed("🎵", localization("rankedleGameStartedTitle")))
		.setColor(gameColor())
		.setDescription([
			localization("rankedleJoinWithCommand"),
			`${localization("rankedlePlayers")}: ${playerList(localization, players)}`
		].join("\n\n"))
}

export function preparingRoundEmbed(localization: localizationFunction, roundNumber: number) {
	return new EmbedBuilder()
		.setTitle(framed("🎵", `${localization("rankedleRound")} ${roundNumber}`))
		.setColor(gameColor())
		.setDescription(`${localization("rankedleSearchingSong")}...`)
}

export function roundEmbed(localization: localizationFunction, roundNumber: number, players: RankedlePlayer[]) {
	return new EmbedBuilder()
		.setTitle(framed("🎵", `${localization("rankedleRound")} ${roundNumber}`))
		.setColor(gameColor())
		.setDescription(`${localization("rankedleGuessPrompt")}\n${localization("rankedleTimeLimit")}: ${getConfig().commands.rankedle.roundTimeLimit} ${localization("seconds")}`)
		.addFields(
			{ name: localization("rankedlePlayers"), value: playerList(localization, players), inline: true },
			{ name: localization("rankedleHints"), value: localization("rankedleHintHowTo"), inline: true }
		)
}

export function correctGuessEmbed(localization: localizationFunction, userId: string, song: RankedleSong) {
	return new EmbedBuilder()
		.setTitle(framed("🎉", localization("rankedleCorrectTitle")))
		.setColor(DiscordVariables.SUCCESS_COLOR)
		.setThumbnail(song.coverUrl)
		.setDescription(`<@${userId}> ${localization("rankedleGuessedIt")}. ${songReference(localization, song)}`)
}

export function songRevealEmbed(localization: localizationFunction, song: RankedleSong, emoji: string, title: string, extra?: string) {
	return new EmbedBuilder()
		.setTitle(`${emoji} ${title}`)
		.setColor(gameColor())
		.setThumbnail(song.coverUrl)
		.setDescription(extra ? `${extra}. ${songReference(localization, song)}` : songReference(localization, song))
}

export function currentScoreEmbed(localization: localizationFunction, players: RankedlePlayer[]) {
	return new EmbedBuilder()
		.setTitle(framed("🏆", localization("rankedleCurrentScoreTitle")))
		.setColor(DiscordVariables.DEFAULT_COLOR)
		.setDescription(scoreList(localization, players))
}

export function resultsEmbed(localization: localizationFunction, players: RankedlePlayer[]) {
	return new EmbedBuilder()
		.setTitle(framed("🏁", localization("rankedleGameOverTitle")))
		.setColor(DiscordVariables.SUCCESS_COLOR)
		.setDescription(`${localization("rankedleFinalResults")}\n\n${scoreList(localization, players)}`)
}

export function globalLeaderboardEmbed(localization: localizationFunction, entries: RankedleLeaderboardEntry[]) {
	return new EmbedBuilder()
		.setTitle(framed("🏆", localization("rankedleLeaderboardTitle")))
		.setColor(DiscordVariables.DEFAULT_COLOR)
		.setDescription(globalScoreList(localization, entries))
		.setFooter({ text: localization("rankedleLeaderboardFull") })
}

export function leaderboardPageEmbed(localization: localizationFunction, entries: RankedleLeaderboardEntry[], page: number, pageSize: number, totalPages: number) {
	return new EmbedBuilder()
		.setTitle(framed("🏆", localization("rankedleLeaderboardTitle")))
		.setColor(DiscordVariables.DEFAULT_COLOR)
		.setDescription(globalScoreList(localization, entries, (page - 1) * pageSize))
		.setFooter({ text: `${localization("page")} ${page}/${totalPages}` })
}

export function allVotedEmbed(localization: localizationFunction) {
	return new EmbedBuilder()
		.setTitle(`⏭️ ${localization("rankedleAllVotedTitle")}`)
		.setColor(gameColor())
		.setDescription(`${localization("rankedleSkipping")}...`)
}

export function stoppedEmbed(localization: localizationFunction, reason: string) {
	return new EmbedBuilder()
		.setTitle(`🛑 ${localization("rankedleStoppedTitle")}`)
		.setColor(DiscordVariables.ERROR_COLOR)
		.setDescription(reason)
}

export function playerChangeEmbed(userId: string, text: string, color: ColorResolvable) {
	return new EmbedBuilder()
		.setColor(color)
		.setDescription(`<@${userId}> ${text}`)
}

export function hintEmbed(localization: localizationFunction, description: string) {
	return new EmbedBuilder()
		.setTitle(`💡 ${localization("rankedleHintTitle")}`)
		.setColor(DiscordVariables.WARNING_COLOR)
		.setDescription(description)
}

export function joinRow(localization: localizationFunction) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(RANKEDLE_JOIN_BUTTON)
			.setLabel(`🎮 ${localization("rankedleJoinButton")}`)
			.setStyle(ButtonStyle.Primary)
	)
}

export function voteskipRow(localization: localizationFunction, votes: number, required: number) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(RANKEDLE_VOTESKIP_BUTTON)
			.setLabel(`⏭️ ${localization("rankedleVoteskipButton")} (${votes}/${required})`)
			.setStyle(ButtonStyle.Secondary)
	)
}

export function beatsaverRow(beatsaverID: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setLabel("🗺️ BeatSaver")
			.setStyle(ButtonStyle.Link)
			.setURL(`https://beatsaver.com/maps/${beatsaverID}`)
	)
}

export function leaderboardRows(localization: localizationFunction, page: number, totalPages: number) {
	const row = new ActionRowBuilder<ButtonBuilder>()

	if(page > 1) row.addComponents(
		new ButtonBuilder()
			.setCustomId(`${RANKEDLE_LEADERBOARD_BUTTON}_${page - 1}`)
			.setLabel(`◀️ ${localization("previousPage")}`)
			.setStyle(ButtonStyle.Secondary)
	)

	if(page < totalPages) row.addComponents(
		new ButtonBuilder()
			.setCustomId(`${RANKEDLE_LEADERBOARD_BUTTON}_${page + 1}`)
			.setLabel(`${localization("nextPage")} ▶️`)
			.setStyle(ButtonStyle.Secondary)
	)

	return row.components.length ? [row] : []
}
