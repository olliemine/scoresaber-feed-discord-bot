import { verificationChannelLogin } from "../account/login.js"
import { visitorLogin } from "../account/visitorManager.js"
import { discordUserUpdateHandler, isDiscordCategories } from "../account/userFunctions.js"
import { GuildMember, Message, PartialGuildMember } from "discord.js"
import getConfig from "../../config/getConfig.js"
import appContext from "../../index.js"
import userSchema from "../../models/userSchema.js"
import getLanguage from "../../languages/lang.js"
import { DEBUG_LEVELS, logger } from "../../logger.js"
import { user } from "../../types/db.js"

const createFilter = (discordMember: GuildMember | PartialGuildMember) => ({ "discordID": discordMember.user.id })

export function messageHandler(message: Message) {
	if(message.author.bot || appContext.hasStarted === false) return

	if(getConfig().database["user-login"].VerificationChannel.enabled 
	&& getConfig().database["user-login"].VerificationChannel.id === message.channel.id)
		return verificationChannelLogin(message.content, message)
}

export async function guildMemberAddHandler(discordMember: GuildMember) {
	if(discordMember.guild.id !== getConfig()["server-id"]) return 
	
	const filter = createFilter(discordMember)
	const user = await userSchema.findOne(filter)

	if(!user && getConfig().database["user-login"].IsVisitorWithoutDeclaring) {
		await visitorLogin(discordMember.user, getLanguage.getDefault)
		logger.debug(`User ${discordMember.user.username} automatically logged in as Visitor`, DEBUG_LEVELS.USER_DEBUG)
		return
	}

	let dataUser: user

	try {
		const document = await userSchema.findOneAndUpdate(filter, {
			"discordIsInServer": true 
		})

		if(document == null) return

		dataUser = document
	} catch(err) {
		return
	}

	if(!isDiscordCategories(dataUser.category)) return

	const warnings = await discordUserUpdateHandler(discordMember, dataUser.category, getLanguage.getDefault, dataUser)

	logger.debug(`User ${discordMember.user.username} was automatically activated\n${warnings ? warnings : ""}`, DEBUG_LEVELS.USER_DEBUG)
}

export async function guildMemberRemoveHandler(discordMember: GuildMember | PartialGuildMember) {
	if(discordMember.guild.id !== getConfig()["server-id"]) return

	const filter = createFilter(discordMember)

	await userSchema.updateOne(filter, {
		"discordIsInServer": true 
	})

	logger.debug(`Automatically deactivated user ${discordMember.user.username}`, DEBUG_LEVELS.USER_DEBUG)
}