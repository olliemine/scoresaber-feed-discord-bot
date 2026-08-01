import chalk from "chalk"
import { ChannelType, ColorResolvable, Colors, EmbedBuilder, TextChannel } from "discord.js"
import appContext from "./index.js"
import getConfig from "./config/getConfig.js"
import { responseErrorString } from "./misc/util.js"

const loggerConfig = getConfig().logger

type LOG_TYPES = "info" | "warn" | "error" | "debug" | "fatal" | "configuration"

let channels: {[key in LOG_TYPES]?: TextChannel} = {}

const LOG_TYPE_CONST: {[key in LOG_TYPES]: {console: string, embedColor: ColorResolvable}} = {
	info: {
		console: chalk.blue("INFO"),
		embedColor: Colors.Blue
	},
	warn: {
		console: chalk.yellowBright("WARNING"),
		embedColor: Colors.Yellow
	},
	error: {
		console: chalk.redBright("ERROR"),
		embedColor: Colors.Red
	},
	debug: {
		console: chalk.gray("DEBUG"),
		embedColor: Colors.Blue
	},
	fatal: {
		console: chalk.bgRed("FATAL"),
		embedColor: Colors.DarkRed
	},
	configuration: {
		console: chalk.greenBright("CONFIG"),
		embedColor: Colors.Green
	}
}

function printLog(msg: string, type: LOG_TYPES) {
	const d = new Date()
	
	console.log(`${loggerConfig["enableTimestamp"] ? `[${d.toISOString()}] ` : ""}[${LOG_TYPE_CONST[type].console}] ${msg}`)
	
	const channel = channels[type]

	if(!channel) return

	const embed = new EmbedBuilder()
	.setTitle(type[0].toUpperCase() + type.slice(1))
	.setColor(LOG_TYPE_CONST[type].embedColor)
	.setDescription(msg)

	channel.send({ embeds: [embed] })
}

export function start() {
	for(let log in loggerConfig.logs) {
		if(!loggerConfig.logs[log as LOG_TYPES]) continue

		const channelId = loggerConfig.logs[log as LOG_TYPES]["discord-channel-id"]

		if(!channelId) continue

		const channel = appContext.discordClient.channels.cache.get(channelId)

		if(!channel || channel.type !== ChannelType.GuildText) {
			logger.warn(`Channel id ${channelId} not found, try resetting the bot if it the channel really exists`)
			continue
		}
		
		channels[log as LOG_TYPES] = channel
	}
}

export enum DEBUG_LEVELS {
	FORCED_DEBUG = 0,
	INCEPTION_DEBUG = 1,
	USER_DEBUG = 2,
	REGULARLY_TIMED_DEBUG = 3,
	VARIABLE_DEBUG = 4,
	WEBSOCKET_DEBUG = 4,
}

export const logger = {
	info: (msg: string) => printLog(msg, "info"),
	warn: (msg: string | Error) => {
		if(msg instanceof Error) return printLog(msg.message, "warn")
		printLog(msg, "warn")
	},
	error: (msg: string | Error | Response) => {
		if(typeof msg === "string") return printLog(msg, "error")
		if(msg instanceof Error) return printLog(msg.stack ?? msg.message, "error")
		return printLog(responseErrorString(msg), "error")
	},
	unknownError: (msg: unknown) => {
		if(msg instanceof Error) return logger.error(msg)
		return printLog(`Error is not error: ${msg} at ${new Error().stack}`, "error")
	},
	debug: (msg: string, level: DEBUG_LEVELS = 1) => {
		if(level > getConfig().debug) return
		printLog(msg, "debug")
	},
	fatal: (msg: string) => {
		printLog(msg, "fatal")
		process.abort()
	},
	configuration: (msg: string) => printLog(msg, "configuration")
}
