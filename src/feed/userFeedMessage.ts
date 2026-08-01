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
	if(isRankFeedChange(updateProp)) {
		const currentRank = dataUser[updateProp].value
		const lastRank = dataUser[updateProp].lastFeed

		return {
			updateNum: dataUser[updateProp].value - dataUser[updateProp].lastFeed,
			updateRank: lastRank - currentRank,
			currentRank,
			lastRank,
			dataUser
		}
	}

	const currentRank = await getRank(dataUser, `${updateProp}.value`, false, "descending", matchFilter)
	const lastRank = await getRank(dataUser, `${updateProp}.lastFeed`, false, "descending", matchFilter)
	
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

	let args = input.split("_")

	if(args[0] === "Sniped" || args[0] === "Player") {
		const selectedPlayerUpdate = args[0] === "Sniped" ? snipedUpdate : playerUpdate
		const selectedPlayer = selectedPlayerUpdate.dataUser

		if(args[1] === "scoresaber") return scoresaberRegexes(args[2], selectedPlayer["scoresaberID"], selectedPlayer["scoresaberName"]) ?? ""
		if(args[1] === "country") return countryRegexes(args[2], getUserCountry(selectedPlayer)) ?? ""

		switch(args[1]) {
			case "name": {
				if(!getConfig().database.players.feed[`doPings${args[0]}`]) return selectedPlayer["scoresaberName"]
				if(!selectedPlayer["discordIsInServer"] || !selectedPlayer["discordID"] || !selectedPlayer.configuration.doPingSnipe) return selectedPlayer["scoresaberName"]
				const discordMember = await discordIDtoMember(selectedPlayer["discordID"])
				if(!discordMember) return selectedPlayer["scoresaberName"]
				return `<@${discordMember.user.id}>`
			}
			case "discordName":
				return selectedPlayer["discordName"] ? selectedPlayer["discordName"] : ""
			case "currentRank":
				return selectedPlayerUpdate.currentRank.toString() ?? ""
			case "lastRank":
				return selectedPlayerUpdate.lastRank.toString()
			case "timeSet":
			case "timeSince":
			case "timeSetText":
			case "timeSinceText":
				return dateFormats(args[1], selectedPlayer[updateProp].lastFeedDate, getLanguage.defaultLocale)
			case "globalRank":
				return selectedPlayer.scoresaberRank?.value?.toString() ?? ""
			case "countryRank":
				return selectedPlayer.scoresaberCountryRank?.value?.toString() ?? ""
			case "variable":
				return selectedPlayer[updateProp].value.toString()
			case "lastVariable":
				return selectedPlayer[updateProp].lastFeed.toString()
		}
	}

	let snipedPlayersEditable = snipedPlayers.slice()

	switch(input) {
		case "SnipedUsers":
			return snipedPlayersEditable.map(update => update.dataUser["scoresaberName"]).join(", ")
		case "SnipedUsersExceptFirst":
			snipedPlayersEditable.shift()
			return snipedPlayersEditable.map(update => update.dataUser["scoresaberName"]).join(", ")
		case "Update_block":
			return getCodeBlockOfChanges([...snipedPlayersEditable, playerUpdate], { showCurrentRank: true })
	}

	return ""
}

const embedDecodePicture: embedDecodeFunction<Arguments> = async (pictureType, args) => {
	const { playerUpdate, snipedUpdate } = args

	switch(pictureType) {
		case "PlayerProfilePicture":
			return await getProfilePicture(playerUpdate.dataUser["scoresaberID"]) ?? ""
		case "SnipedProfilePicture":
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

async function postPlayerFeed(
	channelConfiguration: DefaultChannelFeedConfiguration,
	event: string,
	playerUpdate: RankUpdate,
	snipedUpdate: RankUpdate,
	snipedPlayers: RankUpdate[],
	updateProp: UserFeedChanges
) {
	const feedMessages = getConfig().database.players.feed.feedMessages
	if(!feedMessages || !userFeedEventRegexes) return

	return await postFeed(channelConfiguration, event, feedMessages, userFeedEventRegexes, {
		playerUpdate: playerUpdate, snipedUpdate: snipedUpdate, snipedPlayers: snipedPlayers, updateProp: updateProp
	}, stringToDecoded, {
		embedButtons: embedButtons,
		embedDecodePicture: embedDecodePicture
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

	// Rank improvements may post without community snipes; other metrics still require snipes
	if(!isRankFeedChange(updateProp) && (!snipedPlayers || !snipedPlayers.length)) return
	

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

	const handlePostFeed = async (channelConfiguration: DefaultChannelFeedConfiguration, playerUpdate: RankUpdate, snipePlayersProp: RankUpdate[]) => {
		const snipedUpdate = snipePlayersProp[0] ?? {
			updateNum: 0,
			updateRank: 0,
			currentRank: playerUpdate.currentRank,
			lastRank: playerUpdate.lastRank,
			dataUser: { ...playerUpdate.dataUser, scoresaberName: "" }
		}

		await postPlayerFeed(channelConfiguration, combination, playerUpdate, snipedUpdate, snipePlayersProp, updateProp)
	}
	
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
