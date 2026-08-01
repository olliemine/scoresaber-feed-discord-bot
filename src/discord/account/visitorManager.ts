import { User } from "discord.js"
import SentMessageHandler, { CommandMessage } from "../../classes/sentMessageHandler.js"
import { DEBUG_LEVELS, logger } from "../../logger.js"
import { getJSON, writeJSON } from "../../misc/jsonController.js"
import { discordIDtoMember, discordUserUpdateHandler, isDiscordUserLoggedIn, isVisitor, removeRolesFromCategory } from "./userFunctions.js"
import { languageString, localizationFunction } from "../../languages/lang.js"
import getConfig from "../../config/getConfig.js"
import TextChanges from "../../classes/textChanges.js"

export async function visitorLoginHandler<T extends CommandMessage>(sentMessage: SentMessageHandler<T>) {
	const isAlreadyLoggedIn = await isDiscordUserLoggedIn(sentMessage.author)
	if(isAlreadyLoggedIn) return sentMessage.localesError("userAlreadyLoggedIn")
	
	visitorLogin(sentMessage.author, sentMessage.getLocalization).then((res) => {
		sentMessage.successWarningHandler(res, sentMessage.getLocalization("visitorSuccess"))
	}).catch(err => {
		logger.error(err.message)
		sentMessage.error({ description: `${sentMessage.getLocalization("unexpectedError")}: ${err.message}` })
	})
}

export async function visitorLogin(discordUser: User, localization: localizationFunction) {	
	const visitors = await getJSON("visitors")
	
	const discordMember = await discordIDtoMember(discordUser.id)
	
	if(!discordMember) throw new Error(`Discord member (${discordUser.id}) not found`)
	
	visitors.ids.push(discordUser.id)

	await writeJSON("visitors", visitors)

	logger.debug(`User ${discordMember.user.username} logged in as Visitor.`, DEBUG_LEVELS.USER_DEBUG)

	return await discordUserUpdateHandler(discordMember, "Visitor", localization)
}

export async function visitorLogoutHandler<T extends CommandMessage>(sentMessage: SentMessageHandler<T>) {
	visitorLogout(sentMessage.author, sentMessage.getLocalization).then((res) => {
		if(res.isSuccessful === false) return sentMessage.localesError(res.userMessage)
		sentMessage.successWarningHandler(res.warnings, sentMessage.getLocalization(res.userMessage))
	}).catch(err => {
		logger.error(err.message)
		sentMessage.error({ description: `${sentMessage.getLocalization("unexpectedError")}: ${err.message}` })
	})
}

export async function adminVisitorLogoutHandler<T extends CommandMessage>(sentMessage: SentMessageHandler<T>, discordUser: User) {
	visitorLogout(discordUser, sentMessage.getLocalization).then((res) => {
		if(res.isSuccessful === false) return sentMessage.localesError(res.userMessage)
		sentMessage.successWarningHandler(res.warnings, res.adminMessage)
	}).catch(err => {
		logger.error(err.message)
		sentMessage.error({ description: `${sentMessage.getLocalization("unexpectedError")}: ${err.message}` })
	})
}

export async function visitorLogout(discordUser: User, localization?: localizationFunction): Promise<{
	userMessage: languageString,
	adminMessage: string,
	isSuccessful: false
} | {
	userMessage: languageString,
	adminMessage: string,
	isSuccessful: true,
	warnings?: string
}> {
	const resIsVisitor = await isVisitor(discordUser)

	if(!resIsVisitor) {
		const adminMessage = `Discord user (${discordUser.id}) is not a visitor, invalidated logout`
		
		logger.debug(adminMessage, DEBUG_LEVELS.USER_DEBUG)
				
		return {
			userMessage: "visitorUserIsNotVisitor",
			adminMessage,
			isSuccessful: false
		}
	}

	if(getConfig().database["user-login"].IsVisitorWithoutDeclaring) {
		const adminMessage = `Discord user (${discordUser.id}) cannot logout because of the current IsVisitorWithoutDeclaring configuration.`
		
		logger.debug(adminMessage, DEBUG_LEVELS.USER_DEBUG)
		
		return {
			userMessage: "loginDeny",
			adminMessage,
			isSuccessful: false
		}
	}
	
	const discordMember = await discordIDtoMember(discordUser.id)

	if(!discordMember) throw new Error(`Discord member (${discordUser.id}) not found`)

	const visitors = await getJSON("visitors")
	
	visitors.ids.splice(visitors.ids.indexOf(discordUser.id), 1)

	const changes = new TextChanges(localization)

	await removeRolesFromCategory("Visitor", discordMember).then((warningRoles) => {
		if(warningRoles.length) changes.warnings.addWarningRoles(warningRoles)
	})
	
	await discordMember.setNickname(null).catch(() => {
		changes.warnings.addChangeName()
	})
	
	const adminMessage = `User ${discordUser.username} was succesfully logged out.`

	logger.debug(adminMessage, DEBUG_LEVELS.USER_DEBUG)
	
	return {
		userMessage: "logoutSuccess",
		adminMessage,
		isSuccessful: true,
		warnings: changes.textCount ? changes.getText() : undefined
	}
}