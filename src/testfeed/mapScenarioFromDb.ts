import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js"
import { level, levelPlayer } from "../types/db.js"
import { MapChannelFeedConfiguration } from "../types/config.js"
import levelSchema from "../models/levelSchema.js"
import { fetchPlayerScorePage, fetchScoreById } from "../scoresaber/handlers/scoreApi.js"
import { findCompatibleLevel, parseMapFeed } from "./mapQueries.js"
import getConfig from "../config/getConfig.js"

type MapScenario = {
	play: ScoreSaberPlay,
	map: level,
	playerA: levelPlayer,
	playerB?: levelPlayer,
	oldPlayerA?: levelPlayer,
	oldPlayerB?: levelPlayer
}

type LevelPlayerWithId = levelPlayer & { _id?: unknown }
type LeanLevel = level & { _id?: unknown, contextualLeaderboard?: levelPlayer[] }

function copyLevelPlayer(entry: LevelPlayerWithId): levelPlayer {
	return {
		playerID: entry.playerID,
		playerName: entry.playerName,
		category: entry.category,
		score: { ...entry.score },
		country: entry.country,
		date: new Date(entry.date),
		HMD: entry.HMD
	}
}

function levelFromLean(doc: LeanLevel, leaderboard: levelPlayer[]): level {
	return {
		levelID: doc.levelID,
		hash: doc.hash,
		code: doc.code,
		isRanked: doc.isRanked,
		isDeleted: doc.isDeleted,
		positiveModifiers: doc.positiveModifiers,
		stars: doc.stars,
		maxScore: doc.maxScore,
		NPS: doc.NPS,
		BPM: doc.BPM,
		beatsaverLabels: [...doc.beatsaverLabels],
		difficultyInformation: { ...doc.difficultyInformation },
		leaderboard: leaderboard.map(copyLevelPlayer)
	}
}

async function resolveScoreSaberPlay(entry: levelPlayer, map: level): Promise<ScoreSaberPlay> {
	if(entry.score.scoreID != null) {
		const data = await fetchScoreById(entry.score.scoreID)
		if(data) return new ScoreSaberPlay(data, "V2_SCORE")
	}

	const recent = await fetchPlayerScorePage(entry.playerID, 1, 100, "recent")
	const match = recent?.data.find(row =>
		row.leaderboard.id === map.levelID &&
		row.score.modifiedScore === entry.score.modifiedScore &&
		Math.abs(new Date(row.score.createdAt).getTime() - entry.date.getTime()) <= 2000
	)
	if(match) return new ScoreSaberPlay(match, "V2_SCORE")

	throw new Error(
		`Could not load ScoreSaber data for ${entry.playerName} on map ${map.levelID}. ` +
		`Run /migratescoreids or pass score_id.`
	)
}

function pickFeedPlayers(
	feed: string,
	contextual: levelPlayer[],
	fullLeaderboard: levelPlayer[]
): Pick<MapScenario, "playerA" | "playerB" | "oldPlayerA" | "oldPlayerB"> {
	const { eventName } = parseMapFeed(feed)
	const top1IfNoUsers = getConfig().database.maps.feed.top1IfNoUsers === true

	const playerA = contextual[0]
	const playerB = contextual[1]
	const playerC = contextual[2]

	if(!playerA) throw new Error("Matched level has no contextual #1 player.")

	if(eventName === "Top1" || eventName === "Snipe") {
		if(!top1IfNoUsers && !playerB) {
			throw new Error("Matched level has no contextual #2 player for a Top1/Snipe preview.")
		}
		return {
			playerA,
			playerB,
			oldPlayerA: playerB ?? playerA,
			oldPlayerB: playerC
		}
	}

	if(eventName === "BetterTopPlay") {
		return {
			playerA,
			playerB,
			oldPlayerA: playerA,
			oldPlayerB: playerB
		}
	}

	if(eventName === "NewMap" || eventName === "NewPlay" || eventName === "BetterPlay") {
		const scorer = contextual.find(p => p.playerID === playerA.playerID) ?? playerA
		const idx = fullLeaderboard.findIndex(p => p.playerID === scorer.playerID)
		return {
			playerA: scorer,
			playerB: fullLeaderboard[idx + 1],
			oldPlayerA: idx > 0 ? fullLeaderboard[idx] : undefined,
			oldPlayerB: undefined
		}
	}

	return {
		playerA,
		playerB,
		oldPlayerA: playerB,
		oldPlayerB: playerC
	}
}

export async function buildMapScenarioFromDb(
	feed: string,
	channelConfiguration: MapChannelFeedConfiguration
): Promise<MapScenario> {
	const doc = await findCompatibleLevel(feed, channelConfiguration)
	if(!doc) {
		throw new Error(
			`No level in the database matches "${feed}" with this channel's ranked/unranked and PP gates. ` +
			`Try score_id=… after /migratescoreids.`
		)
	}

	const contextual = doc.contextualLeaderboard.map(copyLevelPlayer)
	const fullLeaderboard = doc.leaderboard.map(copyLevelPlayer)
	const map = levelFromLean(doc, fullLeaderboard)
	const players = pickFeedPlayers(feed, contextual, fullLeaderboard)
	const play = await resolveScoreSaberPlay(players.playerA, map)

	return { play, map, ...players }
}

export async function buildMapScenarioFromScoreId(
	feed: string,
	scoreId: number,
	channelConfiguration?: MapChannelFeedConfiguration
): Promise<MapScenario> {
	const data = await fetchScoreById(scoreId)
	if(!data) throw new Error(`ScoreSaber score ${scoreId} was not found.`)

	const play = new ScoreSaberPlay(data, "V2_SCORE")

	if(channelConfiguration) {
		const type = channelConfiguration.Types?.toLowerCase()
		if(type === "ranked" && !play.isRanked) throw new Error(`Score ${scoreId} is not ranked.`)
		if(type === "unranked" && play.isRanked) throw new Error(`Score ${scoreId} is ranked.`)
		if(channelConfiguration.minPP != null && play.pp < channelConfiguration.minPP) {
			throw new Error(`Score ${scoreId} is below minPP (${channelConfiguration.minPP}).`)
		}
		if(channelConfiguration.maxPP != null && play.pp >= channelConfiguration.maxPP) {
			throw new Error(`Score ${scoreId} is at or above maxPP (${channelConfiguration.maxPP}).`)
		}
	}

	const lean = await levelSchema.findOne({ levelID: data.leaderboard.id }).lean() as LeanLevel | null
	const fullLeaderboard = lean?.leaderboard.map(copyLevelPlayer) ?? []
	const map = lean
		? levelFromLean(lean, fullLeaderboard)
		: {
			levelID: data.leaderboard.id,
			hash: data.leaderboard.map.hash,
			code: data.leaderboard.map.bsid ?? undefined,
			isRanked: data.leaderboard.realm.leaderboardStatus === "RANKED",
			isDeleted: false,
			positiveModifiers: data.leaderboard.realm.positiveModifiers,
			stars: data.leaderboard.realm.stars,
			maxScore: data.leaderboard.maxScore,
			BPM: data.leaderboard.map.bpm,
			beatsaverLabels: [],
			difficultyInformation: {
				difficultyNum: data.leaderboard.difficulty.difficulty,
				modeName: data.leaderboard.difficulty.gameMode
			},
			leaderboard: fullLeaderboard
		}

	const playerA: levelPlayer = {
		playerID: data.score.player.id,
		playerName: data.score.player.name,
		category: "Unknown",
		score: {
			scoreID: data.score.id,
			baseScore: data.score.unmodifiedScore,
			modifiedScore: data.score.modifiedScore,
			modifiers: data.score.mods,
			FC: data.score.fullCombo,
			misses: data.score.badCuts + data.score.missedNotes,
			PP: data.score.pp
		},
		country: data.score.player.country,
		date: new Date(data.score.createdAt),
		HMD: data.score.device?.hmd ?? "Unknown"
	}

	if(!map.leaderboard.length) map.leaderboard = [playerA]

	const { context } = parseMapFeed(feed)
	const mainCountries = getConfig()["main-countries"]
	const contextual = context === "MainCountries"
		? map.leaderboard.filter(p => mainCountries.includes(p.country))
		: map.leaderboard

	const players = pickFeedPlayers(feed, contextual.length ? contextual : [playerA], map.leaderboard)
	players.playerA = map.leaderboard.find(p => p.playerID === playerA.playerID) ?? playerA

	return { play, map, ...players }
}
