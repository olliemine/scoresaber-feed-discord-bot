import { LevelDifficulties } from "./external.js"

export const HMDs = {
	0: 'Unknown',
	1: 'Oculus Rift CV1',
	2: 'Vive',
	4: 'Vive Pro',
	8: 'Windows Mixed Reality',
	16: 'Rift S',
	32: 'Oculus Quest',
	64: 'Valve Index',
	128: 'Vive Cosmos'
}

export interface ScoreSaberDevice {
	hmd: string,
	controllerLeft: string,
	controllerRight: string
}

export interface ScoreSaberBadge {
	description: string,
	id: number,
	image: string
}

export interface ScoreSaberUserBodyBasicStats {
	realmId: number,
	realmName: string,
	rank: number,
	countryRank: number,
	rankChange: number,
	totalPP: number,
	plusOnePP: null,
	totalScore: string,
	totalRankedScore: string,
	totalPlayedLeaderboards: number,
	totalPlayedRankedLeaderboards: number,
	totalSubmittedPlays: number,
	totalReplayViews: number,
	averageAccuracy: number,
	weightedAverageAccuracy: number,
	completionAccuracy: number,
	device: ScoreSaberDevice
}

export interface ScoreSaberUserBodyFullStats extends Omit<ScoreSaberUserBodyBasicStats, "plusOnePP"> {
	plusOnePP: number
}

export interface ScoreSaberUserBodyBasic {
	id: string,
	name: string,
	playerNameInGame: string,
	country: string,
	role: string | null,
	avatar: string,
	avatarVersion: string,
	permissions: number,
	banned: boolean,
	inactive: boolean,
	silenced: boolean,
	stats: ScoreSaberUserBodyBasicStats
}

export interface ScoreSaberUserBodyFull extends Omit<ScoreSaberUserBodyBasic, "stats"> {
	bio: string | null,
	vanity: string | null,
	profileCustomization: {
		accentColor: string | null,
		accentForegroundActiveColor: string | null,
		accentForegroundColor: string | null,
		backgroundImage: string | null,
		backgroundImageVersion: number | null,
		badgeComments: {
			propertyName: string
		} | null,
		badgeOrder: number[] | null,
		/**
		 * String[] consists of enum, information https://scoresaber.com/api/docs#tag/players/GET/api/v2/players/{id}
		 */
		chartMetricIds: string[] | null,
		/**
		 * String[] consists of enum, information https://scoresaber.com/api/docs#tag/players/GET/api/v2/players/{id}
		 */
		enabledStatIds: string[] | null,
		/**
		 * String[] consists of enum, information https://scoresaber.com/api/docs#tag/players/GET/api/v2/players/{id}
		 */
		sectionOrder: string[] | null,
		/**
		 * String[] consists of enum, information https://scoresaber.com/api/docs#tag/players/GET/api/v2/players/{id}
		 */
		statOrder: string[] | null,
		supporterNameColorEnabled: boolean
	},
	createdAt: string,
	lastSeenAt: string,
	badges: ScoreSaberBadge[],
	pinnedScores: {}[],
	stats: ScoreSaberUserBodyFullStats
}

export type AnyScoreSaberUserBody = ScoreSaberUserBodyFull | ScoreSaberUserBodyBasic

export interface ScoreSaberMetadata {
	page: number,
	itemsPerPage: number,
	totalItems: number,
	totalPages: number
}

export interface ScoreSaberScore {
	id: number,
	rank: number,
	unmodifiedScore: number,
	modifiedScore: number,
	accuracy: number,
	pp: number,
	weight: number,
	mods: string[],
	badCuts: number,
	missedNotes: number,
	maxCombo: number,
	createdAt: string,
	fullCombo: boolean,
	personalBest: boolean,
	playOutcome: "CLEAR" | "FAIL" | "QUIT" | "RESTART"
	playOutcomeTime: number | null,
	legacyHmdId: keyof typeof HMDs | null,
	hasReplay: boolean,
	/**
	 * Scoresaber version NOT IMPORTANT
	 */
	version: string | null,
	hasHistory: boolean,
	replayViewCount: number,
	player: Pick<ScoreSaberUserBodyBasic, "id" | "name" | "playerNameInGame" | "avatar" | "avatarVersion" | "country" | "role" | "permissions">
	device: ScoreSaberDevice | null
}

export interface ScoreSaberLeaderboard {
	id: number,
	map: {
		id: number,
		hash: string,
		bsid: string | null,
		songName: string,
		songSubName: string,
		songAuthorName: string,
		levelAuthorName: string,
		bpm: number,
		coverUrl: string,
		verified: boolean
	},
	difficulty: {
		id: number,
		difficulty: LevelDifficulties.Number,
		gameMode: string,
		/**
		 * No reason to use this, use difficulty.difficulty instead
		 */
		rawDifficulty: string
	},
	maxScore: number,
	/**
	 * Ignore this? I'm not sure what this is. Appears on really old maps
	 */
	legacyMaxScore: number | null,
	totalScores: number,
	dailyScores: number,
	createdAt: string,
	realm: {
		realmId: number,
		realmName: string,
		leaderboardStatus: "UNRANKED" | "RANKED" | "QUALIFIED" | "LOVED",
		positiveModifiers: boolean,
		modifierValues: string,
		stars: number,
		rankedAt: string | null,
		qualifiedAt: string | null,
		lovedAt: string | null
	}
}

export interface ScoreSaberWebSocketData {
	commandName: "score" | string,
	commandData: {
		score: {
			id: number,
			leaderboardPlayerInfo: {
				id: string,
				name: string,
				profilePicture: string,
				country: string,
				permissions: number,
				badges: ScoreSaberBadge[] | null
			},
			rank: number,
			baseScore: number,
			modifiedScore: number,
			pp: number,
			weight: number,
			modifiers: string,
			multiplier: number,
			badCuts: number,
			missedNotes: number,
			maxCombo: number,
			fullCombo: boolean,
			hmd: keyof typeof HMDs,
			timeSet: string,
			hasReplay: boolean,
			deviceHmd: string,
			deviceControllerLeft: string,
			deviceControllerRight: string
		},
		leaderboard: {
			id: number,
			songHash: string,
			songName: string,
			songSubName: string,
			songAuthorName: string,
			levelAuthorName: string,
			difficulty: {
				leaderboardId: number,
				leaderboard: number,
				difficulty: LevelDifficulties.Number,
				gameMode: string,
				difficultyRaw: string
			},
			maxScore: number,
			maxScoreEx: number,
			createdDate: string,
			rankedDate: string | null,
			qualifiedDate: string | null,
			lovedDate: string | null,
			ranked: boolean,
			qualified: boolean,
			loved: boolean,
			maxPP: number,
			stars: number
			plays: number,
			dailyPlays: number,
			positiveModifiers: boolean,
			playerScore: null,
			coverImage: string,
			difficulties: null
		}
	}
} 

export type ScoreSaberPlayersSearch = {
	data: ScoreSaberUserBodyBasic[],
	metadata: ScoreSaberMetadata
}

export type ScoreSaberPlayersProfile = ScoreSaberUserBodyFull

export type ScoreSaberPlayersBasicProfile = ScoreSaberUserBodyBasic

export type ScoreSaberPlayersScoreData = {
	score: ScoreSaberScore,
	leaderboard: ScoreSaberLeaderboard
}

export type ScoreSaberPlayersScores = {
	data: ScoreSaberPlayersScoreData[],
	metadata: ScoreSaberMetadata
}

export type ScoresaberPlayersCount = {
	count: number
}