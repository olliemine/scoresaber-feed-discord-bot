import { GuildMember, PermissionFlagsBits, User } from "discord.js"
import appContext from "../../index.js"
import getConfig from "../../config/getConfig.js"
import { decodeStringAsync, getRegexLexicon, getRegexLexicons, regexLexicon } from "../../regex/regexLexicon.js"
import { user } from "../../types/db.js"
import { getIDfromLink, idSearch, scoresaberLinkRegex } from "../../scoresaber/handlers/getScoreSaberPlayer.js"
import config from "../../types/config.js"
import userSchema from "../../models/userSchema.js"
import { DEBUG_LEVELS, logger } from "../../logger.js"
import { countryRegexes } from "../../regex/regexFunctions.js"
import { getJSON } from "../../misc/jsonController.js"
import levelSchema from "../../models/levelSchema.js"
import TextChanges from "../../classes/textChanges.js"
import { localizationFunction } from "../../languages/lang.js"
import { PipelineStage } from "mongoose"
import { UpdateOrchestrator } from "../../update/orchestrator.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { AnyScoreSaberUserBody } from "../../types/scoresaber.js"

const regexes = ["discordName", "scoresaberName", "rank", "countryRank", "country_name", "country_code", "country_flag"]
let regexLexicon: {[k: string]: regexLexicon} = {}

export function startLexicon() {
	const config = getConfig()
	
	const getRegexLexiconOptions = {every: true, ifs: false, unique: false}

	let regexExecs = []
	if(config.database["user-login"]["discord-nicknames"].MainCountryUser != null) regexExecs.push({key: "MainCountryUser", data: config.database["user-login"]["discord-nicknames"].MainCountryUser})
	if(config.database["user-login"]["discord-nicknames"].NonMainCountryUser != null) regexExecs.push({key: "NonMainCountryUser", data: config.database["user-login"]["discord-nicknames"].NonMainCountryUser})
	if(config.database["user-login"]["discord-nicknames"].BannedUser != null) regexExecs.push({key: "BannedUser", data: config.database["user-login"]["discord-nicknames"].BannedUser})
	if(config.database["user-login"]["discord-nicknames"].InactiveUser != null) regexExecs.push({key: "InactiveUser", data: config.database["user-login"]["discord-nicknames"].InactiveUser})

	const data = getRegexLexicons(regexExecs, regexes, [], getRegexLexiconOptions)
	regexLexicon = data.regexLexicon

	if(config.database["user-login"]["discord-nicknames"].Visitor == null) return 

	const regexLexiconVisitor = getRegexLexicon(config.database["user-login"]["discord-nicknames"].Visitor, ["discordName"], [], getRegexLexiconOptions)
	if(regexLexiconVisitor) regexLexicon.Visitor = regexLexiconVisitor.regexLexicon
}

export function checkLevel(id: string, member: GuildMember): COMMAND_PERMISSIONS {
	if(getConfig()["masters-user-ids"].includes(id)) return COMMAND_PERMISSIONS.MASTER
	if(getConfig()["admin-roles"].length === 0 ? member.permissions.has(PermissionFlagsBits.Administrator) : 
	getConfig()["admin-roles"].some(roleID => member.roles.cache.has(roleID))) return COMMAND_PERMISSIONS.ADMIN
	return COMMAND_PERMISSIONS.BASE
}

export async function hasPermissionLevel(id: string, level: COMMAND_PERMISSIONS): Promise<boolean> {
	const member = await discordIDtoMember(id)

	return member ? checkLevel(member.user.id, member) >= level : false
}

async function stringToDecoded(input: string, dataArguments: dataArguments): Promise<string> {
	const { scoresaberUser, discordMember, dataUser, newName } = dataArguments
	
	const args = input.split("_")
	
	
	if(input.startsWith("country_")) {
		if(!dataUser) return ""
		const userCountry = getUserCountry(dataUser)
		return countryRegexes(args[1], userCountry)
	}

	switch(input) {
		case "discordName":
			if(newName) return newName

			if(dataUser && dataUser["discordServerNickname"]) return dataUser["discordServerNickname"]

			return discordMember ? discordMember.user.username : ""
		case "scoresaberName":
			if(newName) return newName
			
			if(dataUser && dataUser["discordServerNickname"]) return dataUser["discordServerNickname"]
			
			if(scoresaberUser) return scoresaberUser.name
			
			if(dataUser) return dataUser.scoresaberName
		case "rank":
			if(!scoresaberUser) return ""

			return (dataUser?.scoresaberRank?.value || scoresaberUser.stats.rank).toString()
		case "countryRank":
			if(dataUser?.scoresaberCountryRank?.value) return dataUser.scoresaberCountryRank.value.toString()

			if(!scoresaberUser) return ""
			return scoresaberUser.stats.countryRank.toString()
	}

	return ""
}

export const isFromMainCountry = (country: string) => getConfig()["main-countries"].includes(country.toUpperCase()) 

export const getUserCountry = (dataUser: user) => dataUser.unofficialCountry ?? dataUser.scoresaberCountry

type nameParameters = {scoresaberUser?: AnyScoreSaberUserBody, dataUser?: user, discordMember: GuildMember, newName?: string}

type dataArguments = {scoresaberUser?: AnyScoreSaberUserBody, dataUser?: user, discordMember: GuildMember, newName?: string}

export type UserCategories = "MainCountryUser" | "NonMainCountryUser" | "InactiveUser" | "BannedUser" | "Unknown"

export type DiscordCategories = Exclude<UserCategories, "Unknown"> | "Visitor"

export type AnyCategories = UserCategories | DiscordCategories

export function isUserCategories(category: AnyCategories): category is UserCategories {
	return category === "Unknown" || category !== "Visitor"
}
export function isDiscordCategories(category: AnyCategories): category is DiscordCategories {
	return category === "Visitor" || category !== "Unknown"
}

export async function changeName(
	parameters: nameParameters,
	category: DiscordCategories
)
{	
	if(!parameters.scoresaberUser && parameters.dataUser) {
		const scoresaberUserRes = await idSearch(parameters.dataUser.scoresaberID, false)
		if(scoresaberUserRes.status) parameters.scoresaberUser = scoresaberUserRes.body
	}
	
	const categoryNickname = getConfig().database["user-login"]["discord-nicknames"][category]
	
	if(!categoryNickname || categoryNickname === "{discordName}") return
	
	let nickname = await decodeStringAsync(categoryNickname, regexLexicon[category], stringToDecoded, parameters, {
		removeSlashOption: false
	})

	if(nickname.length > 32) nickname = nickname.slice(0, 29) + "..."

	if(nickname == null || nickname === parameters.discordMember.nickname) return
	
	if(checkIfPermissionToChangeDiscordUser(parameters.discordMember.user.id)) throw new Error("Unable to change nickname, not enough permissions")
	
	try {
		await parameters.discordMember.setNickname(nickname)
	} catch(err) {
		if(err instanceof Error) logger.error(err.message)
		throw new Error("Unable to change nickname, not enough permissions")
	}

	
	if(parameters.newName != null && parameters.dataUser) {
		await userSchema.updateOne({ "scoresaberID": parameters.dataUser.scoresaberID }, { "discordServerNickname": parameters.newName })
	}
}

export async function discordUserUpdateHandler(
	discordMember: GuildMember,
	category: DiscordCategories,
	localization: localizationFunction,
	dataUser?: user,
	scoresaberUser?: AnyScoreSaberUserBody,
	previousCategory?: DiscordCategories
) {
	const changes = new TextChanges(localization)
	
	try {
		await changeName({ discordMember, dataUser, scoresaberUser }, category)
	} catch(err) {
		if(err instanceof Error) changes.warnings.addChangeName(err.name)
	}

	try {
		const res = await giveRoles(category, discordMember, previousCategory)
		if(res.result === false) changes.warnings.addWarningRoles(res.errorRoles)
	} catch(err) {
		if(err instanceof Error) logger.error(err.message)
	}

	return changes.textCount === 0 ? null : changes.getText()
}

function checkIfPermissionToChangeDiscordUser(id: string): boolean {	
	return !!appContext.server && appContext.server.ownerId === id
} 

export async function discordIDtoMember(id: string): Promise<GuildMember | null> {
	if(!id || !appContext.server) return null
	
	try {
		let member = appContext.server.members.cache.get(id)
		
		if(!member) member = await appContext.server.members.fetch(id)
		
		return member
	} catch(err) {
		return null
	}
}

export async function actionRoles(roles: string[], discordMember: GuildMember, action: "remove" | "add") {
	let errorRoles: string[] = []
	
	for await(let id of roles) {
		try {
			if(discordMember.roles.cache.has(id) === (action === "add" ? true : false)) continue				

			await discordMember.roles[action](id)
		} catch(err) {
			if(!appContext.server) continue
			
			const role = appContext.server.roles.cache.get(id)
			
			if(!role) {
				logger.warn(`Role (${id}) was not found`)
				continue
			}

			errorRoles.push(role.name)
		}
	}

	return errorRoles
}

export async function giveRoles(
	category: DiscordCategories,
	discordMember: GuildMember,
	previousCategory?: DiscordCategories
): Promise<{
	result: true
} | {
	result: false,
	errorRoles: string[]
}> {
	let errorRoles: string[] = []
	
	let newErrorRoles = await actionRoles(getConfig().database["user-login"]["give-roles"][category], discordMember, "add")

	errorRoles = errorRoles.concat(newErrorRoles)
		
	if(!previousCategory) newErrorRoles = await removeEveryOtherRole(category, discordMember)
	else newErrorRoles = await removeRolesFromCategory(previousCategory, discordMember)

	errorRoles = [...new Set(errorRoles.concat(newErrorRoles))]

	return errorRoles.length > 0 ? { result: false, errorRoles } : { result: true }
}

async function removeEveryOtherRole(
	category: DiscordCategories,
	discordMember: GuildMember
) {
	let errorRoles: string[] = []
	
	for(let prop in getConfig().database["user-login"]["give-roles"]) {
		if(category && prop === category) continue

		let newErrorRoles = await actionRoles(
			getConfig().database["user-login"]["give-roles"][prop as keyof config["database"]["user-login"]["give-roles"]],
			discordMember,
			"remove"
		)

		errorRoles = errorRoles.concat(newErrorRoles)
	}

	return errorRoles
}

export async function removeRolesFromCategory(
	category: DiscordCategories,
	discordMember: GuildMember
) {
	return await actionRoles(
		getConfig().database["user-login"]["give-roles"][category],
		discordMember,
		"remove"
	)
}

export async function getDataUserFromDiscordUser(discordUser: User) {
	return (await userSchema.findOne({"discordID": discordUser.id}))?.toObject()
}

export async function isDiscordUserLoggedIn(discordUser: User) {	
	const isDataUser = await userSchema.exists({ "discordID": discordUser.id })
	if(isDataUser) return true

	return await isVisitor(discordUser)
}

export async function isVisitor(discordUser: User) {
	const visitors = await getJSON("visitors")
	return visitors.ids.includes(discordUser.id)
}

export function shouldAccountExist(dataUser: user) {
	if((dataUser.category === "Unknown" && !getConfig().database.players.Unknowns.SaveUnknowns) ||
	(!dataUser["discordID"] && 
	(isFromMainCountry(getUserCountry(dataUser)) ? !getConfig().database.players.Unknowns.SaveUnknowns : true))) return false
	return true
}

export async function changeCountry(dataUser: user, country: string) {
	appContext.regionNames.of(country)

	const countryUpperCase = country.toUpperCase()
	const updatedUser: user = {
		...dataUser,
		unofficialCountry: countryUpperCase,
		scoresaberCountryRank: dataUser.scoresaberCountryRank
			? { ...dataUser.scoresaberCountryRank, lastFeed: 0 }
			: dataUser.scoresaberCountryRank
	}

	await userSchema.updateOne({ "scoresaberID": dataUser.scoresaberID }, {
		unofficialCountry: countryUpperCase,
		"scoresaberCountryRank.lastFeed": 0
	})
	await levelSchema.updateMany({ "leaderboard.playerID": dataUser.scoresaberID }, { "leaderboard.$.country": countryUpperCase })

	await UpdateOrchestrator.runSingle(updatedUser)

	return updatedUser
}

/**
 * If user should still be actively be kept saved
 * @param dataUser 
 * @returns 
 */
export function isSaved(dataUser: user) {
	if((dataUser.category === "Unknown" && !getConfig().database.players.Unknowns.SaveUnknowns) ||
		(dataUser.category === "NonMainCountryUser" && !getConfig().database.players.update["enable-updates-for-NonMainCountryUsers"]) ||
		dataUser.category === "BannedUser" ||
		dataUser.category === "InactiveUser" || 
		(dataUser.category === "Unknown" &&
		dataUser.scoresaberLastPP.value !== 0 && 
		dataUser.scoresaberLastPP.value < getConfig().database.players.update.ppLimit)) return false
	return true
}

export async function nameFussySearch(str: string, projection?: PipelineStage): Promise<user[]> {
	const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

	const pipeline: PipelineStage[] = [
		{
			$match: {
				$or: [
					{ scoresaberName: { $regex: escaped, $options: "i" } },
					{ discordName: { $regex: escaped, $options: "i" } },
				]
			}
		},
		{
			$addFields: {
				_matchPriority: {
					$cond: [
						{ $regexMatch: { input: "$scoresaberName", regex: `^${escaped}`, options: "i" } },
						0,
						1
					]
				}
			}
		},
		{ $sort: { _matchPriority: 1, scoresaberName: 1 } },
		...(projection ? [projection] : []),
		{ $limit: 25 }
	]

	return await userSchema.aggregate(pipeline)
}

export async function findDataUserInString(str: string): Promise<null | user | user[]> {	
	if(scoresaberLinkRegex.test(str)) return await userSchema.findOne({ scoresaberID: getIDfromLink(str) })
	
	let dataUser: user | void | null = null

	if(+str) dataUser = await userSchema.findOne({ "discordID": str }).catch(err => logger.error(err))
	
	if(dataUser) return dataUser
	
	if(/<@!\d+>/.test(str)) dataUser = await userSchema.findOne({ "discordID": str.replace(/[<@!>]/g, "") }).catch(err => logger.error(err))
	
	if(dataUser) return dataUser
	
	if(+str) dataUser = await userSchema.findOne({ scoresaberID: str }).catch(err => logger.error(err))
	
	if(dataUser) return dataUser

	const dataUsers = await nameFussySearch(str)
	
	return dataUsers && dataUsers[0] ? dataUsers as user[] : null
}