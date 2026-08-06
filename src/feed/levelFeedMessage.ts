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
			return map["isRanked"] ? player.score.PP.toFixed(2) : ""
		
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
	input = input.toLowerCase()
	const args = input.split("_")
	const { score, playerA, playerB, map, oldPlayerA, oldPlayerB } = dataArguments
	
	if(args[0] === "level") {
		const arg = args[1]
		switch(arg) {
			case "scoresaberlink":
				return getScoresaberLink(map)
			
			case "beatsaverlink":
				return await getBeatsaverLink(map)

			case "code":
				if(!map.code) {
					const foundMap = await getMissingInformationMap(map)

					if(!foundMap) return ""
				
					return foundMap.code ? foundMap.code : ""
				}
				return map.code ? map.code : ""

			case "songname":
				return score.songName

			case "songsubname":
				return score.songSubName

			case "songauthorname":
				return score.songAuthorName

			case "mappername":
				return score.levelAuthorName

			case "difficulty":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.FullName ?? "bleh"

			case "difficultyformated":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.FullNameFormated ?? "bleh"

			case "difficultytiny":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.SmallerName ?? "bleh"

			case "difficultytiniest":
				return LevelDifficulties.Array.find(l => l.Number === map.difficultyInformation.difficultyNum)?.SmallestName ?? "bleh"

			case "gamemode":
				return map.difficultyInformation.modeName

			case "ranked":
				return map.isRanked ? "✅" : ""

			case "creationdate":
				return fullTimestamp(score.levelCreatedAt)
	
			case "creationsince":
				return relativeTimestamp(score.levelCreatedAt)

			case "stars":
				return map["isRanked"] ? map.stars.toString() : ""
		}
	}

	if(args[0] === "snipe") {
		if(!playerB) return ""

		switch(args[1]) {
			case "differencescore":
				return (playerA.score.modifiedScore - playerB.score.modifiedScore).toString()

			case "differencescorepercentage":
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

	if(args[0] === "player") {
		const playerSide = args[1] === "a" ? "A" : "B"
		const player = playerSide === "A" ? playerA : playerB
		const oldPlayer = playerSide === "A" ? oldPlayerA : oldPlayerB

		if(!player) {
			logger.warn(`Player B not found. It is recomended to check if there is a regex in a Score event, Player B regexes are only enabled for Snipe events`)
			return ""
		}

		const isPlayerB = playerSide === "B"

		switch(args[2]) {
			case "averagetop1countrate": {
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

			case "id":
				return player.playerID
			
			case "name": {
				if(!getConfig().database.maps.feed[`doPingsPlayer${playerSide}`]) return player.playerName
				
				const dataUser = await userSchema.findOne({ "scoresaberID": player.playerID })
				
				if(!dataUser || !dataUser["discordIsInServer"] || !dataUser.configuration.doPingSnipe || !dataUser["discordID"]) return player.playerName
				
				const discordMember = await discordIDtoMember(dataUser["discordID"])
				
				if(!discordMember) return player.playerName
				
				return `<@${discordMember.user.id}>`
			}
			case "link":
				return `https://scoresaber.com/u/${player.playerID}`

			case "databaserank": {
				const rank = await getRank(player.playerID, "scoresaberLastPP.value", false)
				
				if(rank === null) return ""
				
				return rank.toString()
			}
			case "rank":
			case "countryrank": {
				const dataUser = await userSchema.findOne({ scoresaberID: player.playerID })
				const value = args[2] === "rank" ? dataUser?.scoresaberRank?.value : dataUser?.scoresaberCountryRank?.value
				return value != null ? value.toString() : ""
			}
			case "leaderboardrank": {
				if(isPlayerB) return ""
				const index = map.leaderboard.findIndex(p => p.playerID === player.playerID)
				return index === -1 ? "" : (index + 1).toString()
			}
			case "basescore":
			case "modifiedscore":
			case "basescorepercentage":
			case "modifiedscorepercentage":
			case "score":
			case "scorepercentage":
			case "modifiers":			
			case "misscount":
			case "isfc":			
			case "misses":
			case "scorepp":
				return await playerBasicInputHandler(args[2], player, map)

			case "scoreweightedpp": {
				if(!map["isRanked"]) return ""
				
				if(!isPlayerB) return (player.score.PP * score.weight).toString()
				
				return ""	
			}
			case "timeset":
			case "timesince":
			case "timesettext":
			case "timesincetext":
				return dateFormats(args[2], player.date, getLanguage.defaultLocale)

			case "hmd":
				return player.HMD

			case "scoredifference":
				if(oldPlayer == null) return ""
				return (getScore(player, map.positiveModifiers) - getScore(oldPlayer, map.positiveModifiers)).toString()

			case "scoredifferencepercentage":
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

			case "oldbasescore":
			case "oldmodifiedscore":
			case "oldbasescorepercentage":
			case "oldmodifiedscorepercentage":
			case "oldscore":
			case "oldscorepercentage":
			case "oldmodifiers":			
			case "oldmisscount":
			case "oldisfc":			
			case "oldmisses":
			case "oldscorepp":
				if(oldPlayer == null) return ""
				return playerBasicInputHandler(args[2].substring(3), oldPlayer, map)

			case "oldtimeset":
			case "oldtimesince":
			case "oldtimesettext":
			case "oldtimesincetext":
				if(oldPlayer == null) return ""
				return dateFormats(args[2].substring(3), oldPlayer.date, getLanguage.defaultLocale)
		}
	}

	logger.error(`No decoding found for ${input}`)
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

	switch(pictureType.toLowerCase()) {
		case "playeraprofilepicture":
			return await getProfilePicture(playerA.playerID) ?? ""
		case "playerbprofilepicture":
			return playerB ? await getProfilePicture(playerB.playerID) ?? "" : ""
		case "mapcoverpicture":
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