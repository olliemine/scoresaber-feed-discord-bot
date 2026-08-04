import { ButtonBuilder, ButtonStyle } from "discord.js";
import { embedButton, embedDecodeFunction, postFeed } from "../discord/message/regexHandler.js";
import { MapChannelFeedConfiguration, RegexMessage } from "../types/config.js";
import { level, levelPlayer } from "../types/db.js";
import { levelFeedEventRegexes } from "./levelFeedConfiguration.js";
import { getCodeOfMaps } from "../external/beatsaver.js";
import levelSchema from "../models/levelSchema.js"
import { logger } from "../logger.js";
import { getScore } from "../update/levelCounts.js";
import { LevelDifficulties } from "../types/external.js";
import { differenceBetweenNumbers } from "../misc/util.js";
import { averageTop1CountRate, countryRegexes, dateFormats } from "../regex/regexFunctions.js";
import { idSearch } from "../scoresaber/handlers/getScoreSaberPlayer.js";
import getConfig from "../config/getConfig.js";
import { getRank } from "../db/filteredUsers.js";
import { getProfilePicture } from "../scoresaber/player/playerFunctions.js";
import getLanguage from "../languages/lang.js";
import { discordIDtoMember } from "../discord/account/userFunctions.js";
import userSchema from "../models/userSchema.js"
import { createButtonWithEmoji } from "../discord/message/buttons.js";
import { DiscordVariables } from "../classes/sentMessageHandler.js";
import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js";
import { fullTimestamp, relativeTimestamp } from "../misc/time.js";

function getScoresaberLink(map: level) {
	return `https://scoresaber.com/leaderboard/${map.levelID}`
}

async function getMissingInformationMap(map: level) {
	await getCodeOfMaps([map])
		
	const foundMap  = await levelSchema.findOne({ levelID: map.levelID })
	
	if(!foundMap) {
		logger.error(`Not found map (${map.levelID}) after trying to find it's code.`)
		return null
	}

	return foundMap
}

function getScorePercentage(score: number, maxScore: number) {
	return ((score / maxScore)*100).toFixed(2)
}

async function scoreInput(score: number, map: level) {
	if(!map.maxScore) {
		const foundMap = await getMissingInformationMap(map)

		if(!foundMap || map.maxScore == null) return ""
		
		return getScorePercentage(score, map.maxScore)
	}
	return getScorePercentage(score, map.maxScore)
}

async function playerBasicInputHandler(input: string, player: levelPlayer, map: level): Promise<string> {
	const lowerCaseInput = input.toLowerCase()

	switch(lowerCaseInput) {
		case "basescore":
			return player.score.baseScore.toString()

		case "modifiedscore":
			return player.score.modifiedScore.toString()

		case "basescorepercentage":
			return await scoreInput(player.score.baseScore, map)	

		case "modifiedscorepercentage":
			return await scoreInput(player.score.modifiedScore, map)	
		case "score":
			return getScore(player, map.positiveModifiers).toString()

		case "scorepercentage":
			return await scoreInput(getScore(player, map.positiveModifiers), map)		

		case "modifiers":
			return player.score.modifiers.join(",")
		
		case "misscount":
			return player.score.misses.toString()

		case "isfc":
			return player.score.FC ? "FC" : "❌ FC"
		
		case "misses":
			return player.score.FC ? "FC" : player.score.misses === 0 ? "❌ FC" : `${player.score.misses} miss`

		case "scorepp":
			return map["isRanked"] ? " (" + player.score.PP.toFixed(2) + "pp)" : ""
		
		default:
			return ""
	}
}

async function getBeatsaverLink(map: level) {
	let newMap: level
	
	if(!map.code) {		
		const foundMap = await getMissingInformationMap(map)

		if(!foundMap) return ""

		newMap = foundMap
	} else newMap = map

	return newMap?.code ? `https://beatsaver.com/maps/${newMap.code}` : ""
}

type Arguments = {
    score: ScoreSaberPlay
    map: level
    playerA: levelPlayer
    playerB: levelPlayer | undefined
    oldPlayerA: levelPlayer | undefined
    oldPlayerB: levelPlayer | undefined
}

const stringToDecoded: embedDecodeFunction<Arguments> = async (input, dataArguments) => {
	const args = input.split("_")
	const { score, playerA, playerB, map, oldPlayerA, oldPlayerB } = dataArguments
	
	if(args[0] === "Level") {
		const arg = args[1]
		switch(arg) {
			case "scoresaberLink":
				return getScoresaberLink(map)
			
			case "beatsaverLink":
				return await getBeatsaverLink(map)

			case "code":
				if(!map.code) {
					const foundMap = await getMissingInformationMap(map)

					if(!foundMap) return ""
				
					return foundMap.code ? foundMap.code : ""
				}
				return map.code ? map.code : ""

			case "songName":
				return score.songName

			case "songSubName":
				return score.songSubName

			case "songAuthorName":
				return score.songAuthorName

			case "mapperName":
				return score.levelAuthorName

			case "difficulty":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.FullName ?? "bleh"

			case "difficultyFormated":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.FullNameFormated ?? "bleh"

			case "difficultyTiny":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.SmallerName ?? "bleh"

			case "difficultyTiniest":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.SmallestName ?? "bleh"

			case "gameMode":
				return map.difficultyInformation.modeName

			case "ranked":
				return map["isRanked"] ? "✅ Ranked" : "❌ Ranked"

			case "creationDate":
				return fullTimestamp(score.levelCreatedAt)
	
			case "creationSince":
				return relativeTimestamp(score.levelCreatedAt)

			case "stars":
				return map["isRanked"] ? " - " + map.stars.toString() + "★" : ""
		}
	}

	if(args[0] === "Snipe") {
		if(!playerB) return ""

		switch(args[1]) {
			case "differenceScore":
				return (playerA.score.modifiedScore - playerB.score.modifiedScore).toString()

			case "differenceScorePercentage":
				let usingMap: level
			
				if(!map.maxScore) {
					const foundMap = await getMissingInformationMap(map)

					if(!foundMap) return ""

					usingMap = foundMap 
				} else usingMap = map
				
				if(!usingMap.maxScore) return ""
				
				return ((differenceBetweenNumbers(
					getScore(playerA, usingMap.positiveModifiers),
					getScore(playerB, usingMap.positiveModifiers)
				)
					/ usingMap.maxScore)*100)
				.toFixed(2)
		}
	}

	if(args[0] === "Player") {
		const player = args[1] === "A" ? playerA : playerB
		const oldPlayer = args[1] === "A" ? oldPlayerA : oldPlayerB

		if(!player) {
			logger.warn(`Player B not found. It is recomended to check if there is a regex in a Score event, Player B regexes are only enabled for Snipe events`)
			return ""
		}

		const isPlayerB = args[1] === "A" ? false : true

		switch(args[2]) {
			case "averageTop1CountRate": {
				const scoresaberUser = await idSearch(player.playerID, false)

				if(!scoresaberUser.status) return "API ERROR"

				return await averageTop1CountRate(
					[args[3] as "country" | "server", args[4] as number | "rounded" | "ratio", args[5] as "ranked"],
					scoresaberUser.body.stats.totalPlayedLeaderboards,
					scoresaberUser.body.stats.totalPlayedRankedLeaderboards,
					player.playerID,
					player.country
				)
			}
			case "country":
				return countryRegexes(args[3], player.country)

			case "ID":
				return player.playerID
			
			case "name": {
				if(!getConfig().database.maps.feed[`doPingsPlayer${args[1] as "A" | "B"}`]) return player.playerName
				
				const dataUser = await userSchema.findOne({ "scoresaberID": player.playerID })
				
				if(!dataUser || !dataUser["discordIsInServer"] || !dataUser.configuration.doPingSnipe || !dataUser["discordID"]) return player.playerName
				
				const discordMember = await discordIDtoMember(dataUser["discordID"])
				
				if(!discordMember) return player.playerName
				
				return `<@${discordMember.user.id}>`
			}
			case "link":
				return `https://scoresaber.com/u/${player.playerID}`

			case "databaseRank": {
				const rank = await getRank(player.playerID, "scoresaberLastPP.value", false)
				
				if(rank === null) return ""
				
				return rank.toString()
			}
			case "baseScore":
			case "modifiedScore":
			case "baseScorePercentage":
			case "modifiedScorePercentage":
			case "score":
			case "scorePercentage":
			case "modifiers":			
			case "missCount":
			case "isFC":			
			case "misses":
			case "scorePP":
				return await playerBasicInputHandler(args[2], player, map)

			case "scoreWeightedPP": {
				if(!map["isRanked"]) return ""
				
				if(!isPlayerB) return (player.score.PP * score.weight).toString()
				
				return ""	
			}
			case "timeSet":
			case "timeSince":
			case "timeSetText":
			case "timeSinceText":
				return dateFormats(args[2], player.date, getLanguage.defaultLocale)

			case "HMD":
				return player.HMD

			case "scoreDifference":
				if(oldPlayer == null) return ""
				return (getScore(player, map.positiveModifiers) - getScore(oldPlayer, map.positiveModifiers)).toString()

			case "scoreDifferencePercentage":
				if(oldPlayer == null) return ""

				if(!map.maxScore) {
					const foundMap = await getMissingInformationMap(map)

					if(!foundMap || !foundMap.maxScore) return ""
				
					return getScorePercentage(
						(getScore(player, map.positiveModifiers) - getScore(oldPlayer, map.positiveModifiers)),
						foundMap.maxScore
					)
				}

				return getScorePercentage(
					(getScore(player, map.positiveModifiers) - getScore(oldPlayer, map.positiveModifiers)),
					map.maxScore	
				)

			case "oldBaseScore":
			case "oldModifiedScore":
			case "oldBaseScorePercentage":
			case "oldModifiedScorePercentage":
			case "oldScore":
			case "oldScorePercentage":
			case "oldModifiers":			
			case "oldMissCount":
			case "oldIsFC":			
			case "oldMisses":
			case "oldScorePP":
				if(oldPlayer == null) return ""
				return playerBasicInputHandler(args[2].substring(3), oldPlayer, map)

			case "oldTimeSet":
			case "oldTimeSince":
			case "oldTimeSetText":
			case "oldTimeSinceText":
				if(oldPlayer == null) return ""
				return dateFormats(args[2].substring(3), oldPlayer.date, getLanguage.defaultLocale)
		}
	}

	logger.warn(`No decoding found for ${input}`)
	return ""
}

const embedButtons: embedButton<Arguments>[] = [{
	name: "beatsaver",
	create: async (args) => {
		const { map } = args
		const link = await getBeatsaverLink(map)
		if(!link) return null
		return createButtonWithEmoji(new ButtonBuilder().setLabel("Beatsaver").setStyle(ButtonStyle.Link).setURL(link), DiscordVariables.BEATSAVER_EMOJI)
	}
}, {
	name: "scoresaber",
	create: (args) => {
		const { map } = args
		const link = getScoresaberLink(map)
		if(!link) return null
		return createButtonWithEmoji(new ButtonBuilder().setLabel("Leaderboard").setStyle(ButtonStyle.Link).setURL(link), DiscordVariables.SCORESABER_EMOJI)
	}
}, {
	name: "scoresaberPlayerA",
	create: (args) => {
		const { playerA } = args
		return createButtonWithEmoji(new ButtonBuilder().setLabel(playerA.playerName).setStyle(ButtonStyle.Link).setURL(`https://scoresaber.com/u/${playerA.playerID}`), DiscordVariables.SCORESABER_EMOJI)
	}
}, {
	name: "scoresaberPlayerB",
	create: (args) => {
		const { playerB } = args
		
		if(!playerB) return null
		
		return createButtonWithEmoji(new ButtonBuilder().setLabel(playerB.playerName).setStyle(ButtonStyle.Link).setURL(`https://scoresaber.com/u/${playerB.playerID}`), DiscordVariables.SCORESABER_EMOJI)
	}
}]

const embedDecodePicture: embedDecodeFunction<Arguments> = async (pictureType, args) => {
	const { playerA, playerB, score } = args

	switch(pictureType) {
		case "PlayerAProfilePicture":
			return await getProfilePicture(playerA.playerID) ?? ""
		case "PlayerBProfilePicture":
			return playerB ? await getProfilePicture(playerB.playerID) ?? "" : ""
		case "MapCoverPicture":
			return score.coverImage
		default:
			return ""
	}
}

export async function postLevelFeed(
	channelConfiguration: MapChannelFeedConfiguration,
	event: string,
	score: ScoreSaberPlay,
	map: level,
	playerA: levelPlayer,
	playerB?: levelPlayer,
	oldPlayerA?: levelPlayer,
	oldPlayerB?: levelPlayer
) {
	if(!levelFeedEventRegexes) return

	return await postFeed(channelConfiguration, event, getConfig().database.maps.feed.feedMessages as {
		[k: string]: RegexMessage
	}, levelFeedEventRegexes,
		{ score, map,playerA, playerB, oldPlayerA, oldPlayerB }, 
		stringToDecoded, {
			embedButtons: embedButtons,
			embedDecodePicture: embedDecodePicture,
		}
	)
}