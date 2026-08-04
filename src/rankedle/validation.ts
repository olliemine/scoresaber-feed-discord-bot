import { languageString } from "../languages/lang.js"
import * as gameState from "./gameState.js"

function channelError(channelId: string): languageString | null {
	if(!gameState.isActive()) return "rankedleNoActiveGame"
	if(channelId !== gameState.getChannelId()) return "rankedleGameInAnotherChannel"
	return null
}

export function joinError(userId: string, channelId: string): languageString | null {
	const error = channelError(channelId)

	if(error) return error
	if(gameState.isPlayer(userId)) return "rankedleAlreadyJoined"

	return null
}

export function participationError(userId: string, channelId: string): languageString | null {
	const error = channelError(channelId)

	if(error) return error
	if(!gameState.isPlayer(userId)) return "rankedleOnlyPlayers"

	return null
}

export function voteskipError(userId: string, channelId: string): languageString | null {
	const error = participationError(userId, channelId)

	if(error) return error
	if(gameState.isRoundCompleted()) return "rankedleRoundAlreadyEnded"
	if(!gameState.getCurrentRound()) return "rankedleNoCurrentSong"
	if(gameState.hasVoted(userId)) return "rankedleAlreadyVoted"

	return null
}
