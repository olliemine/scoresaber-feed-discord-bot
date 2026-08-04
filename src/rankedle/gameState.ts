import { MessageCollector, User } from "discord.js"
import { RankedleGame, RankedleHint, RankedlePlayer, RankedleRound } from "../types/rankedle.js"

const HINTS: RankedleHint[] = ["audio_extension", "uploader_info", "difficulty_info", "cover_image"]

function emptyGame(): RankedleGame {
	return {
		active: false,
		channelId: "",
		players: [],
		currentRound: null,
		roundNumber: 0,
		usedHints: [],
		usedHashes: [],
		voteskipUserIds: [],
		roundCompleted: false,
		roundActivity: false,
		collector: null
	}
}

let game = emptyGame()

export const isActive = () => game.active
export const getChannelId = () => game.channelId
export const getPlayers = (): RankedlePlayer[] => game.players
export const getCurrentRound = () => game.currentRound
export const getUsedHashes = () => [...game.usedHashes]
export const isRoundCompleted = () => game.roundCompleted
export const hadRoundActivity = () => game.roundActivity
export const isPlayer = (id: string) => game.players.some(player => player.id === id)
export const highestScore = () => game.players.reduce((highest, player) => Math.max(highest, player.score), 0)

export function start(channelId: string) {
	game = emptyGame()
	game.active = true
	game.channelId = channelId
}

export function end(): string[] {
	const usedHashes = game.usedHashes

	game.active = false
	game.collector?.stop("stopped")
	game = emptyGame()

	return usedHashes
}

export function addPlayer(user: User): boolean {
	if(isPlayer(user.id)) return false

	game.players.push({ id: user.id, name: user.username, score: 0 })

	return true
}

export function removePlayer(id: string): boolean {
	const index = game.players.findIndex(player => player.id === id)

	if(index === -1) return false

	game.players.splice(index, 1)

	return true
}

export function incrementScore(id: string) {
	const player = game.players.find(player => player.id === id)

	if(player) player.score++
}

export function beginRound(): number {
	game.roundNumber++
	game.currentRound = null
	game.usedHints = []
	game.voteskipUserIds = []
	game.roundCompleted = false
	game.roundActivity = false
	game.collector = null

	return game.roundNumber
}

export function markSongUsed(hash: string) {
	if(!game.usedHashes.includes(hash)) game.usedHashes.push(hash)
}

export function setRound(round: RankedleRound) {
	game.currentRound = round
}

export function completeRound() {
	game.roundCompleted = true
}

export function markActivity() {
	game.roundActivity = true
}

export function setCollector(collector: MessageCollector | null) {
	game.collector = collector
}

export function stopRound(reason: string) {
	game.collector?.stop(reason)
}

export function useHint(): RankedleHint | null {
	const unused = HINTS.filter(hint => !game.usedHints.includes(hint))

	if(!unused.length) return null

	const hint = unused[Math.floor(Math.random() * unused.length)]

	game.usedHints.push(hint)

	return hint
}

export function addVoteskip(id: string): boolean {
	if(!isPlayer(id) || game.voteskipUserIds.includes(id)) return false

	game.voteskipUserIds.push(id)

	return true
}

export const hasVoted = (id: string) => game.voteskipUserIds.includes(id)
export const getVoteskip = () => ({ votes: game.voteskipUserIds.length, required: game.players.length })
export const isVoteskipComplete = () => game.players.length > 0 && game.voteskipUserIds.length >= game.players.length
