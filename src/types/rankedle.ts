import { MessageCollector } from "discord.js"
import { LevelDifficulties } from "./external.js"

export type RankedleHint = "audio_extension" | "uploader_info" | "difficulty_info" | "cover_image"

export interface RankedlePlayer {
	id: string
	name: string
	score: number
}

export interface RankedleLeaderboardEntry {
	id: string
	name: string
	globalScore: number
}

export interface RankedleDifficulty {
	name: LevelDifficulties.FullNameFormated
	stars: number | null
}

export interface RankedleSong {
	beatsaverID: string
	hash: string
	name: string
	songAuthor: string
	levelAuthor: string
	duration: number
	coverUrl: string
	downloadUrl: string
	difficulties: RankedleDifficulty[]
}

export interface RankedleRound {
	song: RankedleSong
	clipStart: number
	clipPath: string
}

export interface RankedleGame {
	active: boolean
	channelId: string
	players: RankedlePlayer[]
	currentRound: RankedleRound | null
	roundNumber: number
	usedHints: RankedleHint[]
	usedHashes: string[]
	voteskipUserIds: string[]
	roundCompleted: boolean
	roundActivity: boolean
	collector: MessageCollector | null
}
