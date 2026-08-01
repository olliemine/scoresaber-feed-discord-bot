import { getAllPlays, getTotalScores } from "../player/playerFunctions.js";

export async function getPlaysUnknownPlayer(unknownPlayerID: string) {
	const limit = await getTotalScores(unknownPlayerID)
	
	if(!limit) throw new Error(`Limit not found on scoresaber player (${unknownPlayerID})`)
	
	const playerScores = await getAllPlays(unknownPlayerID, limit)
	
	if(!playerScores || !playerScores[0]) return []

	return playerScores
}