import { DEBUG_LEVELS, logger } from "../logger.js"
import Buffer from "../classes/buffer.js"
import WebSocketHandler from "../classes/webSocketHandler.js"
import WebSocket from "ws"
import { user } from "../types/db.js"
import { ScoreSaberWebSocketData } from "../types/scoresaber.js"
import userSchema from "../models/userSchema.js"
import { isSaved } from "../discord/account/userFunctions.js"
import { getCodesOfMissingCodeMaps } from "../external/beatsaver.js"
import { UpdateOrchestrator } from "../update/orchestrator.js"
import { ExtractQueueFunctionParams } from "../classes/queue.js"
import levelQueue from "../update/levelQueue.js"
import levelUpdateCounters from "../update/levelUpdateCounters.js"
import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js"

async function scoreHandling(scores: {
	dataUser: user,
	score: ScoreSaberWebSocketData["commandData"]
}[]) {
	

	try {
		const elements = scores.reduce<ExtractQueueFunctionParams<typeof levelQueue>[]>((acc, current) => {
			const index = acc.findIndex((v) => v[0].scoresaberID === current.dataUser.scoresaberID)

			const play = new ScoreSaberPlay(current.score, "WEBSOCKET_SCORE")

			if(index !== -1) {
				acc[index][1].push(play)
			} else {
				acc.push([current.dataUser, [play]])
			}

			return acc
		}, [])

		await levelQueue.getElements(elements)

		await levelUpdateCounters({ skipFeed: true })

		const savedIds = [...new Set(
			scores.filter(score => isSaved(score.dataUser)).map(score => score.dataUser.scoresaberID)
		)]

		// Plays were just saved — only refresh profiles, don't refetch full score history
		if(savedIds.length) {
			const refreshUsers = (await userSchema.find({ scoresaberID: { $in: savedIds } })).map(u => u.toObject())
			await UpdateOrchestrator.runMulti(refreshUsers, undefined, { skipLevelUpdate: true })
		}

		await getCodesOfMissingCodeMaps()
	} catch(err) {
		logger.unknownError(err)
	}
}

const bufferScores = new Buffer(scoreHandling)

const openFunction = () => logger.info("Connected to Scoresaber Socket")
const errorFunction = (err: WebSocket.ErrorEvent) => logger.error(`Error on Scoresaber Socket: ${err}`)
const messageFunction = async (message: WebSocket.MessageEvent) => {
	let data: ScoreSaberWebSocketData
	
	try {
		data = JSON.parse(message.data.toString())
	} catch {
		return
	}

	if(data.commandName !== "score") return

	const score = data.commandData
	const scoresaberUser = score.score.leaderboardPlayerInfo
	
	const dataUser = (await userSchema.findOne({ "scoresaberID": scoresaberUser.id }))?.toObject()
	
	if(dataUser == null || !isSaved(dataUser)) return

	logger.debug(`Got score from ${scoresaberUser.name}`, DEBUG_LEVELS.WEBSOCKET_DEBUG)

	bufferScores.addBuffer({
		dataUser,
		score
	})
}

export default function openSocket() {
	new WebSocketHandler(`wss://scoresaber.com/ws`, openFunction, errorFunction, messageFunction, 0)
}