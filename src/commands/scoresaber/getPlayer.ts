import appContext from "../../index.js"
import { logger } from "../../logger.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import getLanguage from "../../languages/lang.js"
import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder, User } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import { embedDecodeFunction, getRegexMessage } from "../../discord/message/regexHandler.js"
import getConfig from "../../config/getConfig.js"
import { user } from "../../types/db.js"
import { SearchObject, getScoresaberPlayer, idSearch } from "../../scoresaber/handlers/getScoreSaberPlayer.js"
import { getDataUserFromDiscordUser, getUserCountry } from "../../discord/account/userFunctions.js"
import userSchema from "../../models/userSchema.js"
import { AnyScoreSaberUserBody } from "../../types/scoresaber.js"
import { checkRegexOfMessage } from "../../regex/regexLexicon.js"
import { averageTop1CountRate, averageTop1CountRateArr, countryRegexes, decodePercent, scoresaberRegexes } from "../../regex/regexFunctions.js"
import { numberWithCommas } from "../../misc/util.js"
import { getRank, matchMainCountriesUsers } from "../../db/filteredUsers.js"
import { top1CountRate } from "../../db/levelPipelines.js"
import { GetPlayerRegexes } from "../../regex/regexes.js"
import { dataUserAutocomplete } from "../../discord/autocomplete/functions.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { RegexMessage } from "../../types/config.js"

const regexLexiconData = getConfig().commands.getplayer !== undefined ? checkRegexOfMessage(
	getConfig().commands.getplayer as RegexMessage,
	"get",
	GetPlayerRegexes.getAllBasic(),
	GetPlayerRegexes.getAllComplex(),
	{ ifs: true, every: true }
) : null
		
const getValueUndefinedHandler = (value: any) => value != null ? value.toString() : ""

type Arguments = { scoresaberUser: AnyScoreSaberUserBody, dataUser?: user, discordUser?: User }

const stringToDecoded: embedDecodeFunction<Arguments> = async (input, dataArguments) => {
	const { scoresaberUser, dataUser } = dataArguments
	input = input.toLowerCase()
	let args = input.split("_")

	if(input.startsWith("averagerankedaccuracy")) {
		args.shift()
		return decodePercent(args as [string], scoresaberUser.stats.averageAccuracy, 14)
	}

	if(input.startsWith("averagetop1countrate")) {
		args.shift()
		if(!dataUser) return ""
		return await averageTop1CountRate(
			args as averageTop1CountRateArr,
			scoresaberUser.stats.totalSubmittedPlays ?? 0,
			scoresaberUser.stats.totalPlayedRankedLeaderboards ?? 0,
			dataUser
		)
	}

	if(input.startsWith("scoresaber")) {
		args.shift()
		return scoresaberRegexes(args[0], scoresaberUser.id, scoresaberUser.name)
	}

	if(input.startsWith("country_")) {
		args.shift()
		return countryRegexes(args[0], dataUser ? getUserCountry(dataUser) : scoresaberUser.country)
	}
	
	switch(input) {
		case "discordname":
			return dataUser ? dataUser["discordName"] : ""
		case "pp":
			return numberWithCommas(parseFloat(scoresaberUser.stats.totalPP.toFixed(2)))
		case "rank":
			return numberWithCommas(dataUser?.scoresaberRank?.value || scoresaberUser.stats.rank)
		case "countryrank":
			return numberWithCommas(dataUser?.scoresaberCountryRank?.value || scoresaberUser.stats.countryRank)
		case "maincountriesrank":
			if(!dataUser) return ""
			if(dataUser.mainCountriesRank?.value) return numberWithCommas(dataUser.mainCountriesRank.value)
			const mainCountriesRank = await getRank(dataUser, "scoresaberLastPP.value", false, "descending", matchMainCountriesUsers())
			return mainCountriesRank == null ? "" : numberWithCommas(mainCountriesRank)
		case "role":
			return scoresaberUser.role ?? ""
		case "banned":
			return scoresaberUser.banned.toString()
		case "inactive":
			return scoresaberUser.inactive.toString()
		case "totalscore":
			return getValueUndefinedHandler(scoresaberUser.stats.totalScore)
		case "totalrankedscore":
			return getValueUndefinedHandler(scoresaberUser.stats.totalRankedScore)
		case "totalplaycount":
			return getValueUndefinedHandler(scoresaberUser.stats.totalSubmittedPlays)
		case "rankedplaycount":
			return getValueUndefinedHandler(scoresaberUser.stats.totalPlayedRankedLeaderboards)
		case "replayswatched":
			return getValueUndefinedHandler(scoresaberUser.stats.totalReplayViews)
		case "topplaypp":
			return dataUser && dataUser.scoresaberTopPlay ? `${dataUser.scoresaberTopPlay.name} - ${numberWithCommas(parseFloat(dataUser.scoresaberTopPlay.pp.toFixed(2)))}pp` : ""
		case "weekdifference":
			return `${scoresaberUser.stats.rankChange > 0 ? "+" : ""}${scoresaberUser.stats.rankChange}`
		case "servertop1count":
			if(!dataUser) return ""

			return dataUser.top1Multi.value.toString()
		case "servertop1rankedcount": {
			if(!dataUser) return ""

			const count = await top1CountRate(dataUser.scoresaberID, null, true)
			
			return count.toString()
		}
		case "countrytop1count": {
			if(!dataUser) return ""

			const count = await top1CountRate(dataUser.scoresaberID, getUserCountry(dataUser), false)
			
			return count.toString()
		}	
		case "countrytop1rankedcount": {
			if(!dataUser) return ""

			const count = await top1CountRate(dataUser.scoresaberID, getUserCountry(dataUser), true)
			
			return count.toString()	
		}
		default:
			logger.warn(`Invalid stringToDecoded string ${input}`)
			return ""
	}
}

const embedDecodeURL: embedDecodeFunction<Arguments> = (type, args) => {
	const { scoresaberUser } = args

	switch(type.toLowerCase()) {
		case "scoresaber":
			return `https://scoresaber.com/u/${scoresaberUser.id}`
	}

	return ""
}

const embedDecodePicture: embedDecodeFunction<Arguments> = (type, args) => {
	const { scoresaberUser, discordUser } = args
	
	switch(type.toLowerCase()) {
		case "scoresaber":
			return scoresaberUser.avatar
		case "discorduser":
			return discordUser ? discordUser.avatarURL() ?? "" : ""
	}

	return ""
}

const command: BotCommand = {
	name: "get",
	category: "ScoresaberPlayer",
	description: getLanguage.getDefault("getPlayerDescription"),
	descriptionLocale: "getPlayerDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 2,
	slashCommand: new SlashCommandBuilder()
	.setName("get")
	.setDescription(getLanguage.getDefault("getPlayerDescription"))
	.addStringOption(option => option.setName("scoresaber_player")
		.setDescription(getLanguage.getDefault("scoresaberPlayerDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("scoresaberPlayerDescription"))
		.setAutocomplete(true)),
	async autocomplete(interaction: AutocompleteInteraction) {
		return dataUserAutocomplete(interaction)
	},
	async execute(message: ChatInputCommandInteraction) {		
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		
		const regexMessage = getConfig().commands.getplayer

		if(!regexMessage || !regexLexiconData) return //! Default regex value?

		async function buildPage(scoresaberUser: AnyScoreSaberUserBody, multiple: boolean, dataUser?: user, timesCalled?: number) {
			if(!regexMessage || !regexLexiconData) throw new Error("How")
			
			let discordUser: User | undefined
			
			if(dataUser != null && dataUser.discordID) {
				discordUser = appContext.discordClient.users.cache.get(dataUser.discordID)
			}
			
			const decodeArguments: Arguments = { scoresaberUser, discordUser, dataUser }

			const messageObject = await getRegexMessage(regexMessage, regexLexiconData.regexLexicon, decodeArguments, stringToDecoded, {
				embedDecodePicture,
				embedDecodeURL
			})
			
			if(!multiple || "content" in messageObject) return messageObject
			
			messageObject.embeds[0].setFooter({text: `${timesCalled}/${scoresaberUsers.body.length}`})
			
			return messageObject
		}
		
		let scoresaberUsers: SearchObject<true> 

		const str = message.options.getString("scoresaber_player")

		if(!str) {
			const cachethisUser = await getDataUserFromDiscordUser(sentMessage.author)
			if(!cachethisUser) return sentMessage.localesError("invalidUser")
			scoresaberUsers = await idSearch(cachethisUser["scoresaberID"], true)
		} else {
			scoresaberUsers = await getScoresaberPlayer(str, true)
		}

		if(!scoresaberUsers.status) return sentMessage.error({ description: scoresaberUsers.body })
		
		if(scoresaberUsers.body.length === 1) {
			const dataUser = await userSchema.findOne({ "scoresaberID": scoresaberUsers.body[0].id })
			const messageObject = await buildPage(scoresaberUsers.body[0], false, dataUser ?? undefined)
			sentMessage.postOptions(messageObject)
			return
		}
		
		const dataUsers = await userSchema.find({ "scoresaberID": { $in: scoresaberUsers.body.map(p => p.id) }})
		const pagesdata = (await Promise.all(scoresaberUsers.body.map((b: any, i: any) => buildPage(b, true, dataUsers.find(u => u.id === b.id), i + 1))))	
		sentMessage.simplePageMenu(pagesdata, { time: 60*5, stopButton: false })
	},
}

export default command