/**
 * TODO: Language for admin commands
 */
import 'dotenv/config'
import { logger, DEBUG_LEVELS, start as loggerStart } from "./logger.js"
import { start as commandGetterStart } from "./commandGetter.js"
import { autocompleteHandler, handleCommand } from "./commandHandler.js"
import mongo from "./mongo.js"
import { Client, GatewayIntentBits, Partials, REST } from "discord.js"
import { startLexicon as userFunctionsStart } from "./discord/account/userFunctions.js"
import { guildMemberAddHandler, guildMemberRemoveHandler, messageHandler } from "./discord/handlers/client.js"
import { buttonHandler } from "./discord/handlers/buttons.js"
import openSocketScoresaber from "./ws/scoresaber.js"
import openSocketBeatsaver from "./ws/beatsaver.js"
import getConfig from "./config/getConfig.js"
import { UpdateOrchestrator } from './update/orchestrator.js'
import userSchema from "./models/userSchema.js"
import getUnknowns from './scoresaber/player/getUnknowns.js'
import { UPDATE_STATUS_LANGUAGE } from './update/updateStatus.js'
import getLanguage from './languages/lang.js'
import { start as rankedleStart } from './rankedle/roundRunner.js'
import { start as birthdaysStart } from './birthdays/scheduler.js'

let appContext: {discordClient: Client, server?: import("discord.js").Guild, hasStarted: boolean, rest?: REST, regionNames: Intl.DisplayNames} = {
	discordClient: new Client({ 
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.GuildMessageReactions,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.GuildMessageTyping,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.DirectMessages,
			GatewayIntentBits.DirectMessageReactions,
			GatewayIntentBits.DirectMessageTyping,
		], 
		partials: [Partials.Channel], 
		allowedMentions: { repliedUser: false }
	}),
	hasStarted: false,
	regionNames: new Intl.DisplayNames(
		[getConfig().language], {type: 'region'}
	),
}

const discordToken = getConfig().testMode === true ? process.env.DISCORD_TOKEN_TESTING : process.env.DISCORD_TOKEN

if(discordToken == null) {
	console.log("DISCORD_TOKEN not found.")
	process.abort()
}

try {
	appContext.discordClient.login(discordToken)
} catch(err) {
	logger.fatal("An invalid token was provided.")
}

const rest = new REST({ version: '10' }).setToken(discordToken ?? "")

appContext.rest = rest

export default appContext

function setPresence() {
	const activity = getConfig().activity
	
	if(appContext.discordClient.user == null) return
	
	try {
		if(!activity) return appContext.discordClient.user.setPresence({ status: "online" })
		
		appContext.discordClient.user.setPresence({
			status: "online",
			activities: [activity]
		})
	} catch(err: any) {
		logger.error(err.message)
	}
}

async function regularUpdate() {
	try {
		logger.debug("Getting unknowns...", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
		const unknownsRes = await getUnknowns()
		logger.debug(
			"getUnknowns(): " +
			getLanguage.getDefault(UPDATE_STATUS_LANGUAGE[unknownsRes.result]) +
			(unknownsRes.status ? `:\n${unknownsRes.status.getText({ bulletPoints: false })}` : ""),
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)

		logger.debug("Updating players...", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)

		const users = (await userSchema.find()).map((a) => a.toObject())

		//@ts-ignore
		if(users.filter(a => a["$__"] != null)[0]) throw new Error("Invalid Object")

		const multiUserUpdateRes = await UpdateOrchestrator.runMulti(users)
		logger.debug(
			"UpdateOrchestrator.runMulti(): " +
			getLanguage.getDefault(UPDATE_STATUS_LANGUAGE[multiUserUpdateRes.result]) +
			(multiUserUpdateRes.status ? `:\n${multiUserUpdateRes.status.getText({ bulletPoints: false })}` : ""),
			DEBUG_LEVELS.REGULARLY_TIMED_DEBUG
		)

		logger.debug("regularUpdate finished", DEBUG_LEVELS.REGULARLY_TIMED_DEBUG)
	} catch(err) {
		logger.unknownError(err)
	}
}

appContext.discordClient.once("clientReady", async () => {
	loggerStart()
	userFunctionsStart()

	logger.debug("Successfully pre started commands and functions.", DEBUG_LEVELS.INCEPTION_DEBUG)

	appContext.server = appContext.discordClient.guilds.cache.get(getConfig()["server-id"])

	if(!appContext.server) {
		logger.fatal(`Cannot find server (${getConfig()["server-id"]})! Please verify that you have the correct id and that the bot is in the server.`)
	}
	
	logger.debug("Successfully located server", DEBUG_LEVELS.INCEPTION_DEBUG)
	
	setPresence()

	try {
		await mongo()
		logger.debug("MongoDB connection succesfully established.", DEBUG_LEVELS.INCEPTION_DEBUG)
	} catch(err: any) {
		logger.fatal("Failed to connect to MongoDB server: " + err.stack)
	}

	openSocketScoresaber()
	openSocketBeatsaver()
	
	await commandGetterStart()
	
	const defaultConfigurationRefresh = (await import("./config/functions.js")).default

	await defaultConfigurationRefresh()

	await rankedleStart().catch(err => logger.unknownError(err))
	await birthdaysStart().catch(err => logger.unknownError(err))

	appContext.hasStarted = true

	logger.info(`Bot succesfully started! Took ${process.uptime().toFixed(2)}s`)

	regularUpdate()
})

appContext.discordClient.on("messageCreate", (message) => {
	messageHandler(message)
})
.on('interactionCreate', interaction => {
	if(interaction.isChatInputCommand()) return handleCommand(interaction)
	if(interaction.isAutocomplete()) return autocompleteHandler(interaction)
	if(interaction.isButton()) return buttonHandler(interaction)
}).on("guildMemberAdd", async (member) => {
	guildMemberAddHandler(member)
}).on("guildMemberRemove", async (member) => {
	guildMemberRemoveHandler(member)
})

process.on("uncaughtException", (err) => {
	logger.fatal(`uncaughtException: ${err.stack || err}`)
}).on("unhandledRejection", (err) => {
	if(err instanceof Error) logger.error(`unhandledRejection: ${err.stack || err}`)
	if(err) logger.error(`unhandledRejection is not Error!: ${ err}`)
})

setInterval(regularUpdate, 1000*60*60*4)
