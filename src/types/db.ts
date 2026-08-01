import { UserCategories } from "../discord/account/userFunctions.js"
import { LevelDifficulties } from "./external.js"

interface feedNumber {
	value: number,
	lastFeed: number,
	lastFeedDate: Date
}

export interface userMap {
	id: number,
	date: Date,
	name: string,
	hash: string,
	diff: LevelDifficulties.Number,
	mode: string,
	pp: number
}

export type user = {
	scoresaberID: string,
	scoresaberName: string,
	scoresaberIsActive: boolean,
	scoresaberCountry: string,
	unofficialCountry?: string,
	scoresaberLastAverageAccuracy: feedNumber,
	scoresaberLastPP: feedNumber,
	scoresaberRank: feedNumber,
	scoresaberCountryRank: feedNumber,
	mainCountriesRank: feedNumber,
	
	scoresaberHMDs?: string[],
	discordID?: string,
	discordName?: string,
	discordServerNickname?: string,
	discordIsInServer: boolean,
	category: UserCategories,

	totalPlayedCount: number

	top1Single: feedNumber,
	top1Multi: feedNumber,

	"top1Single-porcent": feedNumber,
	"top1Multi-porcent": feedNumber,

	scoresaberLastMap: userMap | null,

	scoresaberTopPlay: userMap | null,

	graphs?: any[],

	configuration: {
		doPingSnipe: boolean
	}
}

export type levelPlayer = {
	playerID: string,
	playerName: string,
	category: string,
	score: {
		baseScore: number,
		modifiedScore: number,
		modifiers: string[],
		FC: boolean,
		misses: number,
		PP: number
	},
	country: string,
	date: Date,
	HMD: string
}

export type level = {
	levelID: number,
	hash: string,
	code?: string,
	isRanked: boolean,
	isDeleted: boolean,
	positiveModifiers: boolean,
	stars: number,
	maxScore?: number,
	NPS?: number,
	BPM?: number,
	beatsaverLabels: string[],
	difficultyInformation: {
		difficultyNum: LevelDifficulties.Number,
		modeName: string
	},
	leaderboard: levelPlayer[]
}