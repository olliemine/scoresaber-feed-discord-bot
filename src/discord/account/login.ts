import { GuildMember, Message, User } from "discord.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { getScoresaberPlayer } from "../../scoresaber/handlers/getScoreSaberPlayer.js"
import userSchema from "../../models/userSchema.js"
import { DEBUG_LEVELS, logger } from "../../logger.js"
import { unexpectedErrorInteractionHandler, userSelection } from "../message/interactions.js"
import { checkUserCategory } from "../../scoresaber/player/playerFunctions.js"
import { discordIDtoMember, discordUserUpdateHandler, isDiscordUserLoggedIn } from "./userFunctions.js"
import { user } from "../../types/db.js"
import getConfig from "../../config/getConfig.js"
import getLanguage, { localizationFunction } from "../../languages/lang.js"
import { visitorLoginHandler } from "./visitorManager.js"
import createUser, { createUserID } from "../../db/createUser.js"
import { PromiseOrNot } from "../../types/util.js"
import { InteractionUserUpdateHandler, UpdateOrchestrator } from "../../update/orchestrator.js"
import { AnyScoreSaberUserBody } from "../../types/scoresaber.js"

export async function login(
	str: string,
	discordMember: GuildMember,
	localization: localizationFunction,
	sentMessage?: SentMessageHandler
): Promise<{
	userMessage: string,
	adminMessage: string,
	isSuccessful: false,
	shouldRespond: boolean
} | {
	userMessage: string,
	adminMessage: string,
	isSuccessful: true,
	shouldRespond: boolean
	playerAlreadyExisted: boolean,
	scoresaberUser: AnyScoreSaberUserBody,
	dataUser: user,
	warnings: null | undefined | string
}> {
	try {
		const discordUser = discordMember.user
		
		let hasAlreadyAccount = await isDiscordUserLoggedIn(discordUser)
		
		if(hasAlreadyAccount) {
			const adminMessage = `User (${discordUser.username}) has already been logged in.`
			
			logger.debug(adminMessage, DEBUG_LEVELS.USER_DEBUG)
			
			return {
				userMessage: localization("userAlreadyLoggedIn"),
				adminMessage: adminMessage,
				isSuccessful: false,
				shouldRespond: true
			}
		}
	
		const res = await getScoresaberPlayer(str, true)
		
		if(!res.status) throw new Error(res.body)
	
		let scoresaberUser: AnyScoreSaberUserBody | null = null
		
		if(res.body.length === 1) scoresaberUser = res.body[0]
		
		else if(sentMessage) scoresaberUser = await userSelection(res.body, sentMessage, "scoresaberUsers")
		
		if(!scoresaberUser) return {
			userMessage: localization("userNotFound"),
			adminMessage: "No scoresaber user found",
			isSuccessful: false,
			shouldRespond: false
		}
	
		const category = checkUserCategory(scoresaberUser)
		
		const existantUser = await userSchema.findOne({ scoresaberID: scoresaberUser.id }).catch()
		
		if(existantUser && existantUser["discordIsInServer"]) {
			const adminMessage = `Scoresaber user ${scoresaberUser.name} (${scoresaberUser.id}) already exists inside the database.`
	
			logger.debug(adminMessage, DEBUG_LEVELS.USER_DEBUG)
			
			return {
				userMessage: localization("loginUserAlreadyExists"),
				adminMessage: adminMessage,
				isSuccessful: false,
				shouldRespond: true
			}
		}

		if(existantUser) {
			const userID = createUserID(scoresaberUser, category, discordUser)

			await userSchema.updateOne({ "scoresaberID": scoresaberUser.id }, userID)
		} else {
			const user = createUser(scoresaberUser, category, discordUser)

			await userSchema.create(user)
		}
		
		const createdUser = (await userSchema.findOne({ "scoresaberID": scoresaberUser.id }))?.toObject()

		if(!createdUser) throw new Error(`No user document for (${scoresaberUser.id}) found`)
		
		const adminMessage = `User ${discordUser.username} has been successfully logged in with ${scoresaberUser.name}`

		logger.debug(adminMessage, DEBUG_LEVELS.USER_DEBUG)
		
		const warnings = await discordUserUpdateHandler(discordMember, category, localization, createdUser, scoresaberUser)

		return {
			userMessage: `${localization("loginSuccessDescription")} ${scoresaberUser.name}`,
			adminMessage: adminMessage,
			isSuccessful: true,
			shouldRespond: true,
			playerAlreadyExisted: !!existantUser,
			scoresaberUser: scoresaberUser,
			dataUser: createdUser,
			warnings: warnings
		}
	} catch(err) {
		logger.unknownError(err)
		
		if(!(err instanceof Error)) {			
			return {
				userMessage: localization("unexpectedError"),
				adminMessage: "unexpectedError",
				isSuccessful: false,
				shouldRespond: true
			}
		}

		
		return {
			userMessage: `${localization("unexpectedError")}: ${err}`,
			adminMessage: err.message,
			isSuccessful: false,
			shouldRespond: true
		}
	}
}

interface LoginInteractionHandler {
	sentMessage: SentMessageHandler
	response(res: Awaited<ReturnType<typeof login>>): PromiseOrNot<void>
	noDiscordMember(id: string): PromiseOrNot<void>
}

export class BaseLoginInteractionHandler implements LoginInteractionHandler {
	public sentMessage: SentMessageHandler
	
	constructor(sentMessage: SentMessageHandler) {
		this.sentMessage = sentMessage
	}

	async response(res: Awaited<ReturnType<typeof login>>) {
		if(res.isSuccessful) {
			await this.sentMessage.successWarningHandler(
				res.warnings,
				res.userMessage,
				"loginSuccessTitle",
				res.scoresaberUser.avatar
			)
			return
		}

		await this.sentMessage.error({ description: res.userMessage })
	}

	async noDiscordMember() {
		await this.sentMessage.localesError("unexpectedError")
	}
}

export class AdminLoginInteractionHandler implements LoginInteractionHandler {
	public sentMessage: SentMessageHandler
	
	constructor(sentMessage: SentMessageHandler) {
		this.sentMessage = sentMessage
	}

	async response(res: Awaited<ReturnType<typeof login>>) {
		if(res.isSuccessful) {
			await this.sentMessage.successWarningHandler(
				res.warnings,
				res.adminMessage,
				"loginSuccessTitle",
				res.scoresaberUser.avatar
			)
			return
		}

		await this.sentMessage.error({ description: res.adminMessage })
	}

	async noDiscordMember(id: string) {
		await this.sentMessage.error({ description: `Discord member (${id}) not found` })
	}
}

export async function interactionLogin(str: string, discordUser: User, interactionHandler: LoginInteractionHandler): Promise<void> {
	try {
		const discordMember = await discordIDtoMember(discordUser.id)
	
		if(!discordMember) {
			logger.error(`Discord member (${discordUser.id}) not found`)
			await interactionHandler.noDiscordMember(discordUser.id)
			return
		}
		
		const res = await login(str, discordMember, interactionHandler.sentMessage.getLocalization, interactionHandler.sentMessage)

		if(!res.shouldRespond) return
			
		await interactionHandler.response(res)

		if(res.isSuccessful) await UpdateOrchestrator.runSingle(
			res.dataUser,
			interactionHandler.sentMessage.getLocalization,
			new InteractionUserUpdateHandler(interactionHandler.sentMessage)
		)
	} catch(err) {
		logger.unknownError(err)
		await unexpectedErrorInteractionHandler(err, interactionHandler.sentMessage)
	}
}

export async function verificationChannelLogin(str: string, message: Message) {
	if(!str || !message) throw new Error("Undefined arguments")
	
	if(getLanguage.getAll("visitor").includes(str.toLowerCase())) {
		const sentMessage = new SentMessageHandler(message)
		return await visitorLoginHandler(sentMessage)
	}

	const sentMessage = await new SentMessageHandler(message).localesLoading()
	
	await interactionLogin(str, message.author, new BaseLoginInteractionHandler(sentMessage))
	
	if(!getConfig().database["user-login"].VerificationChannel.deleteMessages) return
	
	setTimeout(() => {
		message.delete()
		sentMessage.message?.delete()
	}, 1000*10)
}