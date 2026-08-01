import WebSocket from "ws"
import { logger } from "../logger.js"

export default class WebSocketHandler {
	private reconnectRetries = 0
	public webSocketURL: string
	public openFunction: () => void
	public errorFunction: (event: WebSocket.ErrorEvent) => void
	public messageFunction: (event: WebSocket.MessageEvent) => void

	public maxRetries: number

	private readonly RETRY_MS: number = 1000*60

	constructor(
		webSocketURL: string,
		openFunction: () => void,
		errorFunction: (event: WebSocket.ErrorEvent) => void,
		messageFunction: (event: WebSocket.MessageEvent) => void,
		maxRetries = 20
	) {
		this.webSocketURL = webSocketURL
		this.openFunction = openFunction
		this.errorFunction = errorFunction
		this.messageFunction = messageFunction

		this.maxRetries = maxRetries
		this.openWebhook()
	}

	closeFunction = () => {
		logger.warn(`Connection closed in ${this.webSocketURL}, retying in ${this.RETRY_MS / 1000}s`)
		
		this.reconnectRetries++
		
		setTimeout(() => {
			this.openWebhook()
		}, this.RETRY_MS)
	}

	openWebhook() {
		if(this.maxRetries !== 0 && this.reconnectRetries > this.maxRetries) {
			logger.error(`Connection ${this.webSocketURL} permanently closed, reconnectRetry exceeded ${this.maxRetries}.`)
			return
		}

		const socket = new WebSocket(this.webSocketURL)
		
		socket.onopen = this.openFunction
		socket.onclose = this.closeFunction
		socket.onerror = this.errorFunction
		socket.onmessage = this.messageFunction
	}
}