import { DEBUG_LEVELS, logger } from "../logger.js"
import WebSocketHandler from "../classes/webSocketHandler.js"
import WebSocket from "ws"
import levelSchema from "../models/levelSchema.js"
import {
	BeatSaverMapDeleteMessage,
	BeatSaverMapUpdateMessage,
	parseBeatSaverWebSocketMessage,
} from "../types/beatsaver.js"

const openFunction = () => logger.info("Connected to Beatsaver Map Socket")
const errorFunction = (err: WebSocket.ErrorEvent) => logger.error(`Error on Beatsaver Map Socket: ${err}`)

async function handleMapDelete(message: BeatSaverMapDeleteMessage) {
	const { mapId } = message.msg

	const map = await levelSchema.findOne({ code: mapId, isDeleted: { $ne: true } })
	
	if(map == null) return

	logger.debug(`Deleting maps with code ${mapId}`, DEBUG_LEVELS.WEBSOCKET_DEBUG)

	await levelSchema.updateMany({ code: mapId }, { isDeleted: true })
}

async function handleMapUpdate(message: BeatSaverMapUpdateMessage) {
	const mapData = message.msg
	const latestVersion = mapData.versions[0]

	if(!latestVersion) return

	// Initial upload — not a version bump.
	if(mapData.createdAt === latestVersion.createdAt) return

	const mapCode = mapData.id
	const latestHash = latestVersion.hash

	const map = await levelSchema.findOne({ code: mapCode, isDeleted: { $ne: true } })
	if(map == null) return

	logger.debug(
		`Marking outdated versions deleted for map ${mapCode} (latest hash ${latestHash})`,
		DEBUG_LEVELS.WEBSOCKET_DEBUG
	)

	await levelSchema.updateMany(
		{ code: mapCode, hash: { $ne: latestHash } },
		{ isDeleted: true }
	)
}

const messageFunction = async (message: WebSocket.MessageEvent) => {
	let parsed: unknown

	try {
		parsed = JSON.parse(message.data.toString())
	} catch(err) {
		if(err instanceof Error) return logger.error("Couldn't parse message. " + err.message)
		logger.unknownError(err)
		return
	}

	const messageData = parseBeatSaverWebSocketMessage(parsed)
	if(messageData == null) return

	try {
		if(messageData.type === "MAP_DELETE") return await handleMapDelete(messageData)
		if(messageData.type === "MAP_UPDATE") return await handleMapUpdate(messageData)
	} catch(err) {
		if(err instanceof Error) return logger.error(`Unexpected Error on Beatsaver Map Socket: ${err.message}`)
		logger.unknownError(err)
	}
}

export default function openSocket() {
	new WebSocketHandler(`wss://ws.beatsaver.com/maps`, openFunction, errorFunction, messageFunction, 0)
}
