import { AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import SentMessageHandler, { DiscordVariables } from "../../classes/sentMessageHandler.js"
import { BotCommand } from "../../commandGetter.js"
import { localizedSubcommand } from "../../discord/commandBuilders.js"
import getConfig from "../../config/getConfig.js"
import { hasPermissionLevel } from "../../discord/account/userFunctions.js"
import getLanguage from "../../languages/lang.js"
import { logger } from "../../logger.js"
import { prepareBlurredCover, prepareExtendedClip } from "../../rankedle/audio.js"
import * as embeds from "../../rankedle/embeds.js"
import * as gameState from "../../rankedle/gameState.js"
import * as leaderboard from "../../rankedle/leaderboard.js"
import { announcePlayerChange, applyVoteskip, fetchGameChannel, runGame, stopGame } from "../../rankedle/roundRunner.js"
import { joinError, participationError, voteskipError } from "../../rankedle/validation.js"
import { RankedleSong } from "../../types/rankedle.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

type RankedleMessage = SentMessageHandler<ChatInputCommandInteraction>

const EXTENDED_CLIP_NAME = "rankedle-extended.ogg"
const COVER_NAME = "cover-blurred.jpg"

const localization = getLanguage.getDefault

function difficultyList(song: RankedleSong) {
	return song.difficulties
		.map(difficulty => `• **${difficulty.name}**: ${difficulty.stars != null ? `${difficulty.stars}★` : localization("rankedleNotRanked")}`)
		.join("\n")
}

async function isAdmin(sentMessage: RankedleMessage) {
	if(await hasPermissionLevel(sentMessage.author.id, COMMAND_PERMISSIONS.ADMIN)) return true

	await sentMessage.defaultError("commandNotEnoughPermissions")

	return false
}

async function handleStart(message: ChatInputCommandInteraction, sentMessage: RankedleMessage) {
	const configuredChannelId = getConfig().commands.rankedle.channelId

	if(!configuredChannelId) return await sentMessage.defaultError("rankedleNotConfigured")

	if(message.channelId !== configuredChannelId) return await sentMessage.error({
		description: `${localization("rankedleWrongChannel")} <#${configuredChannelId}>`
	})

	const channel = await fetchGameChannel(configuredChannelId)

	if(!channel) return await sentMessage.defaultError("rankedleNotConfigured")
	if(gameState.isActive()) return await sentMessage.defaultError("rankedleAlreadyActive")

	gameState.start(configuredChannelId)
	gameState.addPlayer(sentMessage.author)

	await sentMessage.defaultSuccess("rankedleJoined")

	runGame(channel).catch(async err => {
		logger.unknownError(err)
		await stopGame(channel, getLanguage.getDefault("rankedleUnexpectedStop"))
	})
}

async function handleJoin(message: ChatInputCommandInteraction, sentMessage: RankedleMessage) {
	const error = joinError(sentMessage.author.id, message.channelId)

	if(error) return await sentMessage.defaultError(error)

	gameState.addPlayer(sentMessage.author)

	await sentMessage.defaultSuccess("rankedleJoined")
	await announcePlayerChange(sentMessage.author.id, "rankedleJoinedAnnouncement", DiscordVariables.SUCCESS_COLOR)
}

async function handleLeave(message: ChatInputCommandInteraction, sentMessage: RankedleMessage) {
	if(!gameState.isActive()) return await sentMessage.defaultError("rankedleNoActiveGame")
	if(message.channelId !== gameState.getChannelId()) return await sentMessage.defaultError("rankedleGameInAnotherChannel")
	if(!gameState.removePlayer(sentMessage.author.id)) return await sentMessage.defaultError("rankedleNotPlaying")

	await sentMessage.defaultSuccess("rankedleLeft")

	if(gameState.getPlayers().length) return await announcePlayerChange(sentMessage.author.id, "rankedleLeftAnnouncement", DiscordVariables.ERROR_COLOR)

	const channel = await fetchGameChannel(gameState.getChannelId())

	if(channel) await stopGame(channel, getLanguage.getDefault("rankedleEveryoneLeft"))
}

async function handleStop(sentMessage: RankedleMessage) {
	if(!await isAdmin(sentMessage)) return
	if(!gameState.isActive()) return await sentMessage.defaultError("rankedleNoActiveGame")

	const channel = await fetchGameChannel(gameState.getChannelId())

	if(!channel) return await sentMessage.defaultError("rankedleNotConfigured")

	await stopGame(channel, getLanguage.getDefault("rankedleStoppedByAdmin"))
	await sentMessage.defaultSuccess("rankedleStopped")
}

async function handleSkip(sentMessage: RankedleMessage) {
	if(!await isAdmin(sentMessage)) return
	if(!gameState.isActive()) return await sentMessage.defaultError("rankedleNoActiveGame")
	if(!gameState.getCurrentRound()) return await sentMessage.defaultError("rankedleNoCurrentSong")

	gameState.stopRound("skipped")

	await sentMessage.defaultSuccess("rankedleSkippedTitle")
}

async function handleLeaderboard(message: ChatInputCommandInteraction, sentMessage: RankedleMessage) {
	const page = message.options.getInteger("page") ?? 1
	const totalPages = leaderboard.getTotalPages(leaderboard.LEADERBOARD_PAGE_SIZE)

	if(!totalPages) return await sentMessage.defaultError("rankedleLeaderboardEmpty")

	if(page < 1 || page > totalPages) return await sentMessage.error({
		description: `${localization("rankedleInvalidPage")} ${totalPages}`
	})

	await sentMessage.postOptions({
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

async function handleHint(message: ChatInputCommandInteraction, sentMessage: RankedleMessage) {
	const error = participationError(sentMessage.author.id, message.channelId)

	if(error) return await sentMessage.defaultError(error)

	const round = gameState.getCurrentRound()

	if(!round) return await sentMessage.defaultError("rankedleNoCurrentSong")

	const hint = gameState.useHint()

	if(!hint) return await sentMessage.defaultError("rankedleAllHintsUsed")

	gameState.markActivity()

	await sentMessage.loading()

	switch(hint) {
		case "uploader_info":
			return await sentMessage.postEmbed(embeds.hintEmbed(
				localization,
				`${localization("rankedleHintUploader")} **${round.song.levelAuthor}**`
			))
		case "difficulty_info":
			return await sentMessage.postEmbed(embeds.hintEmbed(
				localization,
				`${localization("rankedleHintDifficulties")}:\n${difficultyList(round.song)}`
			))
		case "audio_extension":
			return await sentMessage.postOptions({
				embeds: [embeds.hintEmbed(localization, `${localization("rankedleHintAudio")} (${getConfig().commands.rankedle.extendedAudioClipDuration} ${localization("seconds")})`)],
				files: [new AttachmentBuilder(await prepareExtendedClip(round.song, round.clipStart), { name: EXTENDED_CLIP_NAME })]
			})
		case "cover_image":
			try {
				const cover = await prepareBlurredCover(round.song)

				return await sentMessage.postOptions({
					embeds: [embeds.hintEmbed(localization, localization("rankedleHintCover")).setImage(`attachment://${COVER_NAME}`)],
					files: [new AttachmentBuilder(cover, { name: COVER_NAME })]
				})
			} catch(err) {
				logger.unknownError(err)

				return await sentMessage.postEmbed(
					embeds.hintEmbed(localization, localization("rankedleHintCoverFallback")).setImage(round.song.coverUrl)
				)
			}
	}
}

async function handleVoteskip(message: ChatInputCommandInteraction, sentMessage: RankedleMessage) {
	const error = voteskipError(sentMessage.author.id, message.channelId)

	if(error) return await sentMessage.defaultError(error)

	gameState.addVoteskip(sentMessage.author.id)

	const { votes, required } = gameState.getVoteskip()

	await sentMessage.success({ description: `${localization("rankedleVoteRegistered")} (${votes}/${required})` })

	const channel = await fetchGameChannel(gameState.getChannelId())

	if(channel) await applyVoteskip(channel)
}

const command: BotCommand = {
	name: "rankedle",
	category: "Games",
	categoryLocale: "gameCategory",
	description: getLanguage.getDefault("rankedleDescription"),
	descriptionLocale: "rankedleDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 3,
	slashCommand: new SlashCommandBuilder()
		.setName("rankedle")
		.setDescription(getLanguage.getDefault("rankedleDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("rankedleDescription"))
		.addSubcommand(localizedSubcommand("start", "rankedleStartDescription"))
		.addSubcommand(localizedSubcommand("join", "rankedleJoinDescription"))
		.addSubcommand(localizedSubcommand("leave", "rankedleLeaveDescription"))
		.addSubcommand(localizedSubcommand("stop", "rankedleStopDescription"))
		.addSubcommand(localizedSubcommand("skip", "rankedleSkipDescription"))
		.addSubcommand(localizedSubcommand("hint", "rankedleHintDescription"))
		.addSubcommand(localizedSubcommand("voteskip", "rankedleVoteskipDescription"))
		.addSubcommand(option => localizedSubcommand("leaderboard", "rankedleLeaderboardDescription")(option)
			.addIntegerOption(integer => integer
				.setName("page")
				.setDescription(getLanguage.getDefault("rankedlePageDescription"))
				.setDescriptionLocalizations(getLanguage.getLocalizations("rankedlePageDescription"))
				.setMinValue(1)
				.setRequired(false))),
	async execute(message) {
		const sentMessage = new SentMessageHandler(message)

		switch(message.options.getSubcommand()) {
			case "start": return await handleStart(message, sentMessage)
			case "join": return await handleJoin(message, sentMessage)
			case "leave": return await handleLeave(message, sentMessage)
			case "stop": return await handleStop(sentMessage)
			case "skip": return await handleSkip(sentMessage)
			case "leaderboard": return await handleLeaderboard(message, sentMessage)
			case "hint": return await handleHint(message, sentMessage)
			case "voteskip": return await handleVoteskip(message, sentMessage)
			default: return await sentMessage.defaultError("invalidCommand")
		}
	}
}

export default command
