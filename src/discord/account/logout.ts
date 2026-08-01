import { discordIDtoMember, removeRolesFromCategory } from "./userFunctions.js"
import { user } from "../../types/db.js"
import userSchema from "../../models/userSchema.js"
import { removeAllRankRoles } from "../../update/userRefresh.js"
import getConfig from "../../config/getConfig.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { logger } from "../../logger.js"
import TextChanges from "../../classes/textChanges.js"
import { wait } from "../../misc/util.js"
import { visitorLoginHandler } from "./visitorManager.js"
import { UpdateOrchestrator } from "../../update/orchestrator.js"
import getLanguage, { languageString } from "../../languages/lang.js"
import { unexpectedErrorInteractionHandler } from "../message/interactions.js"

export async function adminLogoutHandler(dataUser: user, sentMessage: SentMessageHandler) {
	logout(dataUser, sentMessage).then((res) => {
		if(res.isSuccessful === true) return
		
		sentMessage.error({ description: res.adminMessage })
	}).catch((err) => {
		logger.unknownError(err)
		unexpectedErrorInteractionHandler(err, sentMessage)
	})
}

export async function logoutHandler(dataUser: user, sentMessage: SentMessageHandler) {
	logout(dataUser, sentMessage).then((res) => {
		if(res.isSuccessful === true) return
		
		sentMessage.localesError(res.userMessage)
	}).catch((err) => {
		logger.unknownError(err)
		unexpectedErrorInteractionHandler(err, sentMessage)
	})
}

async function logout(dataUser: user, sentMessage: SentMessageHandler): Promise<{
	userMessage: languageString,
	adminMessage: string,
	isSuccessful: false
} | {
	isSuccessful: true
}> {
	if(!dataUser || !dataUser.discordID || !dataUser.discordIsInServer || dataUser.category === "Unknown") {
		return {
			userMessage: "invalidUser",
			adminMessage: getLanguage.getDefault("invalidUser"),
			isSuccessful: false
		}
	}
	
	const discordMember = await discordIDtoMember(dataUser["discordID"])
	
	if(!discordMember) {
		return {
			userMessage: "userNotFound",
			adminMessage: getLanguage.getDefault("userNotFound"),
			isSuccessful: false
		}
	}

	const newDataUser = (await userSchema.findOneAndUpdate({ "scoresaberID": dataUser.scoresaberID }, {
		"discordID": null,
		"discordName": null,
		"discordServerNickname": null,
		"discordIsInServer": false	
	}, {
		returnDocument: "after"
	}).catch(err => {
		logger.unknownError(err)
	}))?.toObject()

	if(!newDataUser) {
		return {
			userMessage: "unexpectedError",
			adminMessage: getLanguage.getDefault("unexpectedError"),
			isSuccessful: false
		}
	}

	const changes = new TextChanges()
	let warningRoles: string[] = []

	warningRoles = await removeAllRankRoles(discordMember)
	warningRoles = warningRoles.concat(await removeRolesFromCategory(dataUser.category, discordMember))
	
	if(warningRoles.length) changes.warnings.addWarningRoles(warningRoles)

	await UpdateOrchestrator.runSingle(newDataUser, sentMessage.getLocalization)

	sentMessage.successWarningHandler(changes.textCount ? changes.getText() : undefined, sentMessage.getLocalization("logoutSuccess"))

	if(!getConfig().database["user-login"].IsVisitorWithoutDeclaring) {
		try {
			await discordMember.setNickname(null)
		} catch(err) {}

		return {
			isSuccessful: true
		}
	}

	await wait(2000)
	
	await sentMessage.localesLoading()

	await visitorLoginHandler(sentMessage)

	return {
		isSuccessful: true
	}
}