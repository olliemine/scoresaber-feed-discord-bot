import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js"
import { UserFeedChanges } from "../feed/userFeed.js"
import { isFromMainCountry } from "../discord/account/userFunctions.js"
import { level, levelPlayer, user } from "../types/db.js"
import { ScoreSaberUserBodyBasic } from "../types/scoresaber.js"
import { getCountryPage } from "../scoresaber/handlers/links.js"
import { fetchWithRetry } from "../misc/util.js"
import { ScoreSaberPlayersSearch } from "../types/scoresaber.js"
import { getMainCountries, getMapChannelConfiguration } from "./feedCatalog.js"
import { buildMapScenarioFromDb, buildMapScenarioFromScoreId } from "./mapScenarioFromDb.js"

type MapScenario = {
	play: ScoreSaberPlay,
	map: level,
	playerA: levelPlayer,
	playerB?: levelPlayer,
	oldPlayerA?: levelPlayer,
	oldPlayerB?: levelPlayer
}

type PlayerScenario = {
	playerUpdate: {
		updateNum: number,
		updateRank: number,
		currentRank: number,
		lastRank: number,
		dataUser: user
	},
	snipedUpdate: {
		updateNum: number,
		updateRank: number,
		currentRank: number,
		lastRank: number,
		dataUser: user
	},
	snipedPlayers: PlayerScenario["playerUpdate"][],
	updateProp: UserFeedChanges
}

function feedNumber(value: number, lastFeed: number) {
	return { value, lastFeed, lastFeedDate: new Date(Date.now() - 3_600_000) }
}

function syntheticUser(profile: ScoreSaberUserBodyBasic, patch: Partial<user> = {}): user {
	return {
		scoresaberID: profile.id,
		scoresaberName: profile.name,
		scoresaberIsActive: !profile.inactive && !profile.banned,
		scoresaberCountry: profile.country,
		discordIsInServer: false,
		category: isFromMainCountry(profile.country) ? "MainCountryUser" : "NonMainCountryUser",
		scoresaberLastAverageAccuracy: feedNumber(profile.stats.averageAccuracy, profile.stats.averageAccuracy - 0.5),
		scoresaberLastPP: feedNumber(profile.stats.totalPP, profile.stats.totalPP - 25),
		scoresaberRank: feedNumber(profile.stats.rank, profile.stats.rank + 5),
		scoresaberCountryRank: feedNumber(profile.stats.countryRank, profile.stats.countryRank + 3),
		mainCountriesRank: feedNumber(profile.stats.countryRank, profile.stats.countryRank + 3),
		totalPlayedCount: profile.stats.totalPlayedLeaderboards,
		top1Single: feedNumber(120, 119),
		top1Multi: feedNumber(95, 94),
		"top1Single-porcent": feedNumber(0.15, 0.14),
		"top1Multi-porcent": feedNumber(0.12, 0.11),
		scoresaberLastMap: null,
		scoresaberTopPlay: null,
		configuration: { doPingSnipe: false },
		...patch
	}
}

function rankUpdate(dataUser: user, updateProp: UserFeedChanges, climb: number) {
	const field = dataUser[updateProp]
	const currentRank = field.value
	const lastRank = currentRank + climb
	return {
		updateNum: field.value - field.lastFeed,
		updateRank: climb,
		currentRank,
		lastRank,
		dataUser
	}
}

function playerUpdatePropFromFeed(feed: string): UserFeedChanges {
	if(feed.startsWith("GlobalRank")) return "scoresaberRank"
	if(feed.startsWith("CountryRank")) return "scoresaberCountryRank"
	if(feed.startsWith("MainCountriesRank")) return "mainCountriesRank"
	if(feed.startsWith("Top1QuantityMaps")) return "top1Multi"
	if(feed.startsWith("Top1PercentageMaps")) return "top1Multi-porcent"
	if(feed.startsWith("AverageAccuracy")) return "scoresaberLastAverageAccuracy"
	throw new Error(`Unknown player feed: ${feed}`)
}

async function fetchCountryPlayers(page: number) {
	const countries = getMainCountries().join(",")
	const res = await fetchWithRetry(getCountryPage(page.toString(), countries))
	if(!res.ok) return []
	const body = await res.json() as ScoreSaberPlayersSearch
	return body.data ?? []
}

export async function findMapScenario(feed: string): Promise<MapScenario> {
	const channelConfiguration = getMapChannelConfiguration(feed)
	if(!channelConfiguration) throw new Error(`Feed "${feed}" is not a map feed.`)
	return buildMapScenarioFromDb(feed, channelConfiguration)
}

export async function findMapScenarioByScoreId(feed: string, scoreId: number): Promise<MapScenario> {
	const channelConfiguration = getMapChannelConfiguration(feed)
	return buildMapScenarioFromScoreId(feed, scoreId, channelConfiguration ?? undefined)
}

export async function findPlayerScenario(feed: string): Promise<PlayerScenario> {
	const updateProp = playerUpdatePropFromFeed(feed)
	const players = await fetchCountryPlayers(1)

	if(players.length < 2) throw new Error("Could not load enough ScoreSaber players for a player feed preview.")

	const climberProfile = players[4] ?? players[0]
	const snipedProfile = players[5] ?? players[1]

	const climber = syntheticUser(climberProfile)
	const sniped = syntheticUser(snipedProfile)

	climber[updateProp].lastFeed = climber[updateProp].value + (updateProp.includes("porcent") ? 0.01 : updateProp === "scoresaberLastAverageAccuracy" ? 0.5 : 1)
	if(isRankFeedChange(updateProp)) {
		climber[updateProp].value = Math.max(1, climber[updateProp].value - 5)
	}

	const playerUpdate = rankUpdate(climber, updateProp, 5)
	const snipedUpdate = rankUpdate(sniped, updateProp, -1)

	return {
		playerUpdate,
		snipedUpdate,
		snipedPlayers: [snipedUpdate],
		updateProp
	}
}

function isRankFeedChange(change: UserFeedChanges) {
	return change === "scoresaberRank" || change === "scoresaberCountryRank" || change === "mainCountriesRank"
}

export async function buildMapScenario(feed: string, scoreId?: number): Promise<MapScenario> {
	if(scoreId != null) return findMapScenarioByScoreId(feed, scoreId)
	return findMapScenario(feed)
}
