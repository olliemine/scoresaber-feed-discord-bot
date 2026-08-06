import table from "text-table"
import { ButtonBuilder, ButtonStyle } from "discord.js"
import { user } from "../types/db.js"
import getConfig from "../config/getConfig.js"
import { FeedsEnabled } from "../regex/feedEventHandler.js"
import userSchema from "../models/userSchema.js"
import { isRankFeedChange, UserFeedChanges } from "./userFeed.js"
import { discordIDtoMember, getUserCountry, isFromMainCountry } from "../discord/account/userFunctions.js"
import { getRank, getRankWindowFieldPipeline, matchMainCountriesUsers, matchUsersByCountry } from "../db/filteredUsers.js"
import { DefaultChannelFeedConfiguration } from "../types/config.js"
import { embedButton, embedDecodeFunction, postFeed } from "../discord/message/regexHandler.js"
import { getProfilePicture } from "../scoresaber/player/playerFunctions.js"
import { countryRegexes, dateFormats, scoresaberRegexes } from "../regex/regexFunctions.js"
import { idSearch } from "../scoresaber/handlers/getScoreSaberPlayer.js"
import getLanguage from "../languages/lang.js"
import { DiscordVariables } from "../classes/sentMessageHandler.js"
import { createButtonWithEmoji } from "../discord/message/buttons.js"
import { PipelineStage } from "mongoose"
import { userRefresh } from "../update/userRefresh.js"
import { getUserEventFromCombination, USER_FEEDS, USER_FEEDS_ENABLED, userFeedEventRegexes } from "./userFeedConfiguration.js"
import { includesEvent } from "./feedCommon.js"

function getCodeBlockOfChanges(
	updates: RankUpdate[],
	{ showCurrentRank = true }) {
	const positiveUpdates = updates.filter((update) => {
		return update.updateRank > 0
	})

	const negativeUpdates = updates.filter((update) => {
		return update.updateRank < 0
	})

	let rows = []
	negativeUpdates.length = Math.min(negativeUpdates.length, 15)

	if(positiveUpdates) positiveUpdates.forEach((update) => {
		let row = [`+ ${update.dataUser["scoresaberName"]}`, `${update.updateRank}`]
		if(showCurrentRank === true) row.push(`(#${update.currentRank})`)
		rows.push(row)
	})

	if(positiveUpdates || negativeUpdates) rows.push(["", ""], ["", ""])

	if(negativeUpdates) negativeUpdates.forEach((update) => {
		let row = [`- ${update.dataUser["scoresaberName"]}`, `${update.updateRank}`]
		if(showCurrentRank === true) row.push(`(#${update.currentRank})`)
		rows.push(row)
	})
	
	const message = "```asciidoc\n" + table(rows) + "\n```"

	return message
}

type RankUpdate = {
	updateNum: number,
	updateRank: number,
	currentRank: number,
	lastRank: number,
	dataUser: user
}

async function dataUserToUpdate(dataUser: user, updateProp: UserFeedChanges, matchFilter?: PipelineStage): Promise<RankUpdate> {
	const order = isRankFeedChange(updateProp) ? "ascending" : "descending"

	const currentRank = await getRank(dataUser, `${updateProp}.value`, false, order, matchFilter)
	const lastRank = await getRank(dataUser, `${updateProp}.lastFeed`, false, order, matchFilter)
	
	if(currentRank === null || lastRank === null) throw new Error(`getRank return null on user (${dataUser.scoresaberID})`)

	return {
		updateNum: dataUser[updateProp].value - dataUser[updateProp].lastFeed,
		updateRank: lastRank - currentRank,
		currentRank,
		lastRank,
		dataUser
	}
}

function snipedDataUserToUpdate(dataUser: user, _updateProp: UserFeedChanges, lastRank: number): RankUpdate {
	return {
		updateNum: dataUser.scoresaberLastPP.value - 1,
		updateRank: -1,
		currentRank: lastRank - 1,
		lastRank: lastRank,
		dataUser: dataUser
	}
}

type Arguments = {
	playerUpdate: RankUpdate,
	snipedUpdate: RankUpdate,
	snipedPlayers: RankUpdate[],
	updateProp: UserFeedChanges
}

const stringToDecoded: embedDecodeFunction<Arguments> = async (
	input, 
	dataArguments
) => {
	const { playerUpdate, snipedUpdate, snipedPlayers, updateProp } = dataArguments

	input = input.toLowerCase()
	let args = input.split("_")

	if(args[0] === "sniped" || args[0] === "player") {
		const selectedPlayerUpdate = args[0] === "sniped" ? snipedUpdate : playerUpdate
		const selectedPlayer = selectedPlayerUpdate.dataUser
		const pingKey = args[0] === "sniped" ? "doPingsSniped" : "doPingsPlayer"

		if(args[1] === "scoresaber") return scoresaberRegexes(args[2], selectedPlayer["scoresaberID"], selectedPlayer["scoresaberName"]) ?? ""
		if(args[1] === "country") return countryRegexes(args[2], getUserCountry(selectedPlayer)) ?? ""

		switch(args[1]) {
			case "name": {
				if(!getConfig().database.players.feed[pingKey]) return selectedPlayer["scoresaberName"]
				if(!selectedPlayer["discordIsInServer"] || !selectedPlayer["discordID"] || !selectedPlayer.configuration.doPingSnipe) return selectedPlayer["scoresaberName"]
				const discordMember = await discordIDtoMember(selectedPlayer["discordID"])
				if(!discordMember) return selectedPlayer["scoresaberName"]
				return `<@${discordMember.user.id}>`
			}
			case "discordname":
				return selectedPlayer["discordName"] ? selectedPlayer["discordName"] : ""
			case "currentrank":
				return selectedPlayerUpdate.currentRank.toString() ?? ""
			case "lastrank":
				return selectedPlayerUpdate.lastRank.toString()
			case "timeset":
			case "timesince":
			case "timesettext":
			case "timesincetext":
				return dateFormats(args[1], selectedPlayer[updateProp].lastFeedDate, getLanguage.defaultLocale)
			case "globalrank":
				return selectedPlayer.scoresaberRank?.value?.toString() ?? ""
			case "countryrank":
				return selectedPlayer.scoresaberCountryRank?.value?.toString() ?? ""
			case "variable":
				return selectedPlayer[updateProp].value.toString()
			case "lastvariable":
				return selectedPlayer[updateProp].lastFeed.toString()
		}
	}

	let snipedPlayersEditable = snipedPlayers.slice()

	switch(input) {
		case "snipedusers":
			return snipedPlayersEditable.map(update => update.dataUser["scoresaberName"]).join(", ")
		case "snipedusersexceptfirst":
			snipedPlayersEditable.shift()
			return snipedPlayersEditable.map(update => update.dataUser["scoresaberName"]).join(", ")
		case "updateblock":
			return getCodeBlockOfChanges([...snipedPlayersEditable, playerUpdate], { showCurrentRank: true })
	}

	return ""
}

const embedDecodePicture: embedDecodeFunction<Arguments> = async (pictureType, args) => {
	const { playerUpdate, snipedUpdate } = args

	switch(pictureType.toLowerCase()) {
		case "playerprofilepicture":
			return await getProfilePicture(playerUpdate.dataUser["scoresaberID"]) ?? ""
		case "snipedprofilepicture":
			return await getProfilePicture(snipedUpdate.dataUser["scoresaberID"]) ?? ""
		default:
			return ""
	}
}

const embedButtons: embedButton<Arguments>[] = [{
	name: "scoresaberPlayer",
	create: (args) => {
		const { playerUpdate } = args
		
		return createButtonWithEmoji(
			new ButtonBuilder()
				.setLabel(playerUpdate.dataUser.scoresaberName)
				.setStyle(ButtonStyle.Link)
				.setURL(`https://scoresaber.com/u/${playerUpdate.dataUser.scoresaberID}`)
			, DiscordVariables.SCORESABER_EMOJI
		)
	}
}, {
	name: "scoresaberSniped",
	create: (args) => {
		const { snipedUpdate } = args
		return createButtonWithEmoji(
			new ButtonBuilder()
				.setLabel(snipedUpdate.dataUser.scoresaberName)
				.setStyle(ButtonStyle.Link)
				.setURL(`https://scoresaber.com/u/${snipedUpdate.dataUser.scoresaberID}`)
			, DiscordVariables.SCORESABER_EMOJI
		)
	}
}]

export async function postPlayerFeed(
	channelConfiguration: DefaultChannelFeedConfiguration,
	event: string,
	playerUpdate: RankUpdate,
	snipedUpdate: RankUpdate,
	snipedPlayers: RankUpdate[],
	updateProp: UserFeedChanges,
	options?: { channelIdOverride?: string, testFeedLabel?: string }
) {
	const feedMessages = getConfig().database.players.feed.feedMessages
	if(!feedMessages || !userFeedEventRegexes) return

	return await postFeed(channelConfiguration, event, feedMessages, userFeedEventRegexes, {
		playerUpdate: playerUpdate, snipedUpdate: snipedUpdate, snipedPlayers: snipedPlayers, updateProp: updateProp
	}, stringToDecoded, {
		embedButtons: embedButtons,
		embedDecodePicture: embedDecodePicture,
		channelIdOverride: options?.channelIdOverride,
		testFeedLabel: options?.testFeedLabel
	})
}

function ppNeighborMatchPrefix(player: user, updateProp: UserFeedChanges): PipelineStage[] {
	const pipeline: PipelineStage[] = []

	if(updateProp === "scoresaberCountryRank") pipeline.push(matchUsersByCountry(getUserCountry(player)))
	else if(updateProp === "mainCountriesRank") pipeline.push(matchMainCountriesUsers())

	return pipeline
}

async function findPpSnipedPlayers(player: user, updateProp: UserFeedChanges) {
	const pipeline = ppNeighborMatchPrefix(player, updateProp)

	pipeline.push(
		getRankWindowFieldPipeline("scoresaberLastPP.lastFeed", "descending"),
		{
			$match: {
				"scoresaberLastPP.lastFeed": {
					$gte: player.scoresaberLastPP.lastFeed,
				},
				"scoresaberLastPP.value": {
					$lt: player.scoresaberLastPP.value
				},
				scoresaberID: { $ne: player.scoresaberID }
			}
		}
	)

	return await userSchema.aggregate(pipeline)
}

/** Players who still look above us by stale PP value — refresh them so true snipes aren't missed. */
async function findStalePpNeighbors(player: user, updateProp: UserFeedChanges) {
	const pipeline = ppNeighborMatchPrefix(player, updateProp)

	pipeline.push({
		$match: {
			"scoresaberLastPP.lastFeed": {
				$gte: player.scoresaberLastPP.lastFeed,
			},
			"scoresaberLastPP.value": {
				$gte: player.scoresaberLastPP.value
			},
			scoresaberID: { $ne: player.scoresaberID }
		}
	})

	return await userSchema.aggregate(pipeline)
}

async function refreshNeighborProfiles(users: user[]) {
	const unique = new Map<string, user>()
	for(const u of users) unique.set(u.scoresaberID, u)

	for await(const neighbor of unique.values()) {
		const scoresaberUserRes = await idSearch(neighbor.scoresaberID, false)
		if(!scoresaberUserRes.status) continue

		const profileSync = await userRefresh(neighbor, scoresaberUserRes.body)
		if(profileSync.changes) {
			await userSchema.updateOne({ scoresaberID: neighbor.scoresaberID }, profileSync.changes)
		}
	}
}

export async function postUserFeed(player: user, updateProp: UserFeedChanges) {
	if(!USER_FEEDS) return

	const usePpSnipes = isRankFeedChange(updateProp) || updateProp === "scoresaberLastPP"
	const sameCountryOnly = updateProp === "scoresaberCountryRank"
	const mainCountriesOnly = updateProp === "mainCountriesRank"

	let snipedPlayers: (user & { rank?: number })[] = []

	if(usePpSnipes) {
		snipedPlayers = await findPpSnipedPlayers(player, updateProp)

		if(isRankFeedChange(updateProp)) {
			const toRefresh = snipedPlayers.length
				? snipedPlayers
				: await findStalePpNeighbors(player, updateProp)

			if(toRefresh.length) {
				await refreshNeighborProfiles(toRefresh)
				snipedPlayers = await findPpSnipedPlayers(player, updateProp)
			}
		}
	} else {
		snipedPlayers = await userSchema.aggregate([
			getRankWindowFieldPipeline(`${updateProp}.lastFeed`, "descending"), {
			$match: {
				[`${updateProp}.lastFeed`]: {
					$gte: player[updateProp].lastFeed,
				},
				[`${updateProp}.value`]: {
					$lt: player[updateProp].value
				},
				scoresaberID: { $ne: player.scoresaberID }
			}
		}])
	}

	if(!snipedPlayers || !snipedPlayers.length) return


	const isDataUserMainCountry = isFromMainCountry(getUserCountry(player))
	const playerCountry = getUserCountry(player)

	const snipedPlayersCountries = [...new Set(snipedPlayers.map(p => getUserCountry(p)))]

	const contextes = [
		{
			name: "MainCountries",
			shouldCheck: isDataUserMainCountry && (snipedPlayersCountries.length === 0 || !!snipedPlayersCountries.filter(country => isFromMainCountry(country))[0]),
			matchFilter: matchMainCountriesUsers(),
			snipedPlayersCheck: (p: RankUpdate) => {
				if(!isFromMainCountry(getUserCountry(p.dataUser))) return false
				if(sameCountryOnly) return getUserCountry(p.dataUser) === playerCountry
				return true
			}
		},
		{
			name: "All",
			// MainCountriesRank always requires main-country players on both sides
			shouldCheck: !mainCountriesOnly || isDataUserMainCountry,
			matchFilter: mainCountriesOnly ? matchMainCountriesUsers() : undefined,
			snipedPlayersCheck: (p: RankUpdate) => {
				if(mainCountriesOnly && !isFromMainCountry(getUserCountry(p.dataUser))) return false
				if(sameCountryOnly) return getUserCountry(p.dataUser) === playerCountry
				return true
			}
		}
	]
	
	let combination = ""

	const handlePostFeed = async (channelConfiguration: DefaultChannelFeedConfiguration, playerUpdate: RankUpdate, snipePlayersProp: RankUpdate[]) =>
		await postPlayerFeed(channelConfiguration, combination, playerUpdate, snipePlayersProp[0], snipePlayersProp, updateProp)
	
	async function loopContextes(channelConfiguration: DefaultChannelFeedConfiguration, event: FeedsEnabled["events"][""]) {
		let wasPosted = false

		for await(const context of contextes) {
			if(context.shouldCheck === false) continue 
			combination = `${event.name}${context.name}`
		
			if(!includesEvent(combination, channelConfiguration, getUserEventFromCombination)) continue
			
			const playerUpdate = await dataUserToUpdate(player, updateProp, context.matchFilter)
			const snipedPlayersUpdate = snipedPlayers
				.map(sniped => snipedDataUserToUpdate(sniped, updateProp, sniped.rank ?? 0))
				.filter(context.snipedPlayersCheck)

			if(!snipedPlayersUpdate.length) continue

			wasPosted = true
			await handlePostFeed(channelConfiguration, playerUpdate, snipedPlayersUpdate)

			break
		}

		return wasPosted
	}

	for await(let channelConfiguration of USER_FEEDS) {
		switch(updateProp) {
			case "scoresaberRank":
				await loopContextes(channelConfiguration, USER_FEEDS_ENABLED.events.GlobalRank)
				break
			case "scoresaberCountryRank":
				await loopContextes(channelConfiguration, USER_FEEDS_ENABLED.events.CountryRank)
				break
			case "mainCountriesRank":
				await loopContextes(channelConfiguration, USER_FEEDS_ENABLED.events.MainCountriesRank)
				break
			case "top1Multi":
				await loopContextes(channelConfiguration, USER_FEEDS_ENABLED.events.Top1QuantityMaps)
				break
			case "top1Multi-porcent":
				await loopContextes(channelConfiguration, USER_FEEDS_ENABLED.events.Top1PercentageMaps)
				break
			case "scoresaberLastAverageAccuracy":
				await loopContextes(channelConfiguration, USER_FEEDS_ENABLED.events.AverageAccuracy)
				break
		}
	}
}
