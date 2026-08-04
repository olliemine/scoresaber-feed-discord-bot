import { AttachmentBuilder, ColorResolvable, Message, TextChannel } from "discord.js"
import appContext from "../index.js"
import getConfig from "../config/getConfig.js"
import getLanguage, { languageString } from "../languages/lang.js"
import { logger } from "../logger.js"
import { wait } from "../misc/util.js"
import { RankedleRound } from "../types/rankedle.js"
import * as audio from "./audio.js"
import * as embeds from "./embeds.js"
import * as gameState from "./gameState.js"
import { checkGuess } from "./guessMatching.js"
import * as leaderboard from "./leaderboard.js"
import { pickSong } from "./songSource.js"

const COUNTDOWN_STEP_SECONDS = 5
const CLIP_FILE_NAME = "rankedle.ogg"

type RoundOutcome = "guessed" | "timeout" | "skipped" | "voteskipped" | "stopped"

const localization = getLanguage.getDefault

let roundMessage: Message | null = null

const sortedPlayers = () => [...gameState.getPlayers()].sort((first, second) => second.score - first.score)

export async function start() {
	await leaderboard.load()
	await audio.clearCache()

	if(!await audio.isFfmpegAvailable()) logger.warn("ffmpeg was not found in PATH, Rankedle audio clips will fail")
}

export async function fetchGameChannel(channelId: string): Promise<TextChannel | null> {
	if(!channelId) return null

	const channel = await appContext.discordClient.channels.fetch(channelId).catch(() => null)

	return channel instanceof TextChannel ? channel : null
}

export async function announcePlayerChange(userId: string, text: languageString, color: ColorResolvable) {
	const channel = await fetchGameChannel(gameState.getChannelId())

	if(channel) await channel.send({ embeds: [embeds.playerChangeEmbed(userId, localization(text), color)] })
		.catch(err => logger.unknownError(err))
}

function toOutcome(reason: string): RoundOutcome {
	if(reason === "time") return "timeout"
	if(reason === "guessed" || reason === "skipped" || reason === "voteskipped") return reason
	return "stopped"
}

async function refreshVoteskip() {
	if(!roundMessage || gameState.isRoundCompleted()) return

	const { votes, required } = gameState.getVoteskip()

	await roundMessage.edit({ components: [embeds.voteskipRow(localization, votes, required)] })
		.catch(err => logger.unknownError(err))
}

export async function applyVoteskip(channel: TextChannel) {
	if(!gameState.isVoteskipComplete()) return await refreshVoteskip()

	await channel.send({ embeds: [embeds.allVotedEmbed(localization)] })
		.catch(err => logger.unknownError(err))

	gameState.stopRound("voteskipped")
}

async function cleanup() {
	await audio.removeSongs(gameState.end())
}

export async function stopGame(channel: TextChannel, reason: string) {
	await cleanup()

	await channel.send({ embeds: [embeds.stoppedEmbed(localization, reason)] })
		.catch(err => logger.unknownError(err))
}

async function prepareRound(channel: TextChannel): Promise<RankedleRound | null> {
	try {
		const song = await pickSong(gameState.getUsedHashes())

		gameState.markSongUsed(song.hash)

		const { clipPath, clipStart } = await audio.prepareClip(song)

		return { song, clipPath, clipStart }
	} catch(err) {
		logger.unknownError(err)

		await stopGame(channel, localization("rankedleSongError"))

		return null
	}
}

async function announceRoundEnd(channel: TextChannel, round: RankedleRound, outcome: RoundOutcome, winnerId: string | null) {
	if(roundMessage) await roundMessage.edit({ components: [] }).catch(err => logger.unknownError(err))

	const components = [embeds.beatsaverRow(round.song.beatsaverID)]

	if(outcome === "guessed" && winnerId) return await channel.send({
		embeds: [
			embeds.correctGuessEmbed(localization, winnerId, round.song),
			embeds.currentScoreEmbed(localization, sortedPlayers())
		],
		components
	})

	if(outcome === "skipped" || outcome === "voteskipped") return await channel.send({
		embeds: [embeds.songRevealEmbed(
			localization,
			round.song,
			"⏭️",
			localization(outcome === "skipped" ? "rankedleSkippedTitle" : "rankedleSkippedVoteTitle")
		)],
		components
	})

	if(outcome !== "timeout") return

	const inactive = !gameState.hadRoundActivity()

	await channel.send({
		embeds: [embeds.songRevealEmbed(
			localization,
			round.song,
			inactive ? "💤" : "⏰",
			localization(inactive ? "rankedleInactivityTitle" : "rankedleTimeoutTitle"),
			localization(inactive ? "rankedleInactivityDescription" : "rankedleTimeoutDescription")
		)],
		components
	})
}

async function runRound(channel: TextChannel): Promise<RoundOutcome> {
	const roundNumber = gameState.beginRound()

	roundMessage = await channel.send({ embeds: [embeds.preparingRoundEmbed(localization, roundNumber)] })

	const round = await prepareRound(channel)

	if(!round || !gameState.isActive()) {
		await roundMessage.delete().catch(err => logger.unknownError(err))

		roundMessage = null

		return "stopped"
	}

	gameState.setRound(round)

	await roundMessage.edit({
		embeds: [embeds.roundEmbed(localization, roundNumber, gameState.getPlayers())],
		files: [new AttachmentBuilder(round.clipPath, { name: CLIP_FILE_NAME })],
		components: [embeds.voteskipRow(localization, 0, gameState.getPlayers().length)]
	})

	const collector = channel.createMessageCollector({
		filter: message => gameState.isPlayer(message.author.id),
		time: getConfig().commands.rankedle.roundTimeLimit * 1000
	})

	gameState.setCollector(collector)

	let winnerId: string | null = null

	collector.on("collect", message => {
		gameState.markActivity()

		if(gameState.isRoundCompleted()) return
		if(!checkGuess(message.content, round.song.name, round.song.songAuthor)) return

		gameState.completeRound()
		gameState.incrementScore(message.author.id)

		winnerId = message.author.id

		collector.stop("guessed")
	})

	return await new Promise<RoundOutcome>(resolve => {
		collector.once("end", async (_collected, reason) => {
			const outcome = toOutcome(reason)

			gameState.setCollector(null)
			gameState.completeRound()

			await announceRoundEnd(channel, round, outcome, winnerId).catch(err => logger.unknownError(err))

			roundMessage = null

			resolve(outcome)
		})
	})
}

async function runCountdown(channel: TextChannel) {
	const { countdownSeconds } = getConfig().commands.rankedle

	const message = await channel.send({
		embeds: [embeds.joinEmbed(localization, gameState.getPlayers(), countdownSeconds)],
		components: [embeds.joinRow(localization)]
	})

	for(let remaining = countdownSeconds; remaining > 0; remaining -= COUNTDOWN_STEP_SECONDS) {
		await wait(Math.min(COUNTDOWN_STEP_SECONDS, remaining) * 1000)

		if(!gameState.isActive()) return

		const left = Math.max(0, remaining - COUNTDOWN_STEP_SECONDS)

		if(left > 0) await message.edit({ embeds: [embeds.joinEmbed(localization, gameState.getPlayers(), left)] })
			.catch(err => logger.unknownError(err))
	}

	await message.edit({
		embeds: [embeds.gameStartedEmbed(localization, gameState.getPlayers())],
		components: []
	}).catch(err => logger.unknownError(err))
}

async function finishGame(channel: TextChannel) {
	const players = sortedPlayers()

	await leaderboard.applyScores(players).catch(err => logger.unknownError(err))

	await cleanup()

	await channel.send({
		embeds: [
			embeds.resultsEmbed(localization, players),
			embeds.globalLeaderboardEmbed(localization, leaderboard.getTop(leaderboard.LEADERBOARD_PAGE_SIZE))
		]
	}).catch(err => logger.unknownError(err))
}

export async function runGame(channel: TextChannel) {
	await runCountdown(channel)

	const { maxPointsPerGame, waitBetweenRounds } = getConfig().commands.rankedle

	while(gameState.isActive()) {
		if(gameState.highestScore() >= maxPointsPerGame) return await finishGame(channel)

		const outcome = await runRound(channel)

		if(outcome === "stopped") return
		if(outcome === "timeout" && !gameState.hadRoundActivity()) return await finishGame(channel)

		await wait(waitBetweenRounds * 1000)
	}
}
