import { isObjectEmpty } from "../misc/util.js" 
import getLanguage, { languageString, localizationFunction } from "../languages/lang.js"
import getConfig from "../config/getConfig.js"
import TextChanges from "../classes/textChanges.js"
import { user } from "../types/db.js"
import levelSchema from "../models/levelSchema.js"
import userSchema from "../models/userSchema.js"
import { GuildMember } from "discord.js"
import { checkUserCategory, isUserActive } from "../scoresaber/player/playerFunctions.js"
import config from "../types/config.js"
import { actionRoles, discordIDtoMember, discordUserUpdateHandler, getUserCountry, isDiscordCategories, isFromMainCountry } from "../discord/account/userFunctions.js"
import { logger } from "../logger.js"
import { AnyScoreSaberUserBody } from "../types/scoresaber.js"
import { getRank, matchMainCountriesUsers } from "../db/filteredUsers.js"

function shouldRankRoleBeAssigned(scoresaberUser: AnyScoreSaberUserBody, dataUser: user, roleObject: config["database"]["players"]["roles"]["list"][number]): boolean {
	const rank = scoresaberUser.stats[roleObject.global ? "rank" : "countryRank"]

	if(roleObject.country && roleObject.country.length && !roleObject.country.includes(getUserCountry(dataUser))) {
		return false
	}

	return roleObject.from >= rank && (roleObject.to === 0 || roleObject.to <= rank)
}

function assignRankRoles(scoresaberUser: AnyScoreSaberUserBody, discordMember: GuildMember, dataUser: user) {
	if(!getConfig().database.players.roles.list.length) return

	if(!isUserActive(scoresaberUser) && !getConfig().database.players.roles.GiveRankRolestoInactiveUsers) {
		removeAllRankRoles(discordMember)
		return
	}
	
	getConfig().database.players.roles.list.forEach(object => {
		const roleBeAssigned = shouldRankRoleBeAssigned(scoresaberUser, dataUser, object)

		actionRoles(object.ids, discordMember, roleBeAssigned ? "add" : "remove")
	})
}

export async function removeAllRankRoles(discordMember: GuildMember) {
	return await actionRoles(getConfig().database.players.roles.list.flatMap(obj => obj.ids), discordMember, "remove")
}

class ProfileChangeRegister {
	public localization: localizationFunction
	public changes: {[key: string]: any} = {}
	public levelChanges: {[key: string]: any} = {}
	public debug: TextChanges = new TextChanges()

	constructor(localization: localizationFunction) {
		this.localization = localization
	}

	getLocalizationText(localizationString: languageString) {
		if(!this.localization) return getLanguage.getString(undefined, localizationString)
		return this.localization(localizationString)
	}

	addChange(change: string, value: any, levelChange: false | string,
		debugText = `${change.replace("-", " ")} ${this.getLocalizationText("updateDebugUpdate")}`) {
		
		this.changes[change] = value
		this.debug.addText(debugText, 1)
		if(levelChange !== false) this.levelChanges[`leaderboard.$.${levelChange}`] = value
	}

	async editLevels(dataUser: user) {
		if(isObjectEmpty(this.levelChanges)) return
		
		await levelSchema.updateMany({ "leaderboard.playerID": dataUser.scoresaberID }, this.levelChanges).catch((err) => logger.error(err))
		
		this.levelChanges = {}
	}
}

export async function userRefresh(
	dataUser: user,
	scoresaberUser: AnyScoreSaberUserBody,
	localization: localizationFunction = getLanguage.getDefault
): Promise<{
	changes: {[key: string]: any} | null,
	debugMessage: TextChanges,
	newUser: user
}> {
	const register = new ProfileChangeRegister(localization)

	let updateName = false

	const category = checkUserCategory(scoresaberUser, dataUser)
	const scoresaberActive = isUserActive(scoresaberUser)
	const discordMember = dataUser.discordID && dataUser.discordIsInServer ? await discordIDtoMember(dataUser["discordID"]) : null

	register.debug.addText(`User ${scoresaberUser.name} start`, 0)

	const plainDataUser = (dataUser as { toObject?: () => user }).toObject?.() ?? dataUser
	let dataUserChanges = { ...plainDataUser }

	let change: keyof user

	change = "scoresaberName"
	if(plainDataUser[change] !== scoresaberUser.name) {
		register.addChange(change, scoresaberUser.name, "playerName")
		dataUserChanges[change] = scoresaberUser.name
		updateName = true
	}
	
	const previousCountry = getUserCountry(plainDataUser, scoresaberUser.country)

	change = "scoresaberCountry"
	if(plainDataUser[change] !== scoresaberUser.country) {
		register.addChange(change, scoresaberUser.country, plainDataUser.unofficialCountry ? false : "country")
		dataUserChanges[change] = scoresaberUser.country
		updateName = true
	} else if(!getUserCountry(dataUserChanges, scoresaberUser.country) && scoresaberUser.country) {
		dataUserChanges[change] = scoresaberUser.country
	}

	const countryChanged = previousCountry !== getUserCountry(dataUserChanges, scoresaberUser.country)

	change = "scoresaberIsActive"
	if(dataUser[change] !== scoresaberActive) {
		register.addChange(change, scoresaberActive, false)
		dataUserChanges[change] = scoresaberActive
		updateName = true
	}

	const averageRankedAccuracy = parseFloat(scoresaberUser.stats.averageAccuracy.toFixed(3))
	
	change = "scoresaberLastAverageAccuracy"
	if(dataUser[change].value !== averageRankedAccuracy) {
		register.addChange(`${change}.value`, averageRankedAccuracy, false, register.getLocalizationText("updateDebugAverageAccuracy"))
		
		if(dataUserChanges[change]) dataUserChanges[change].value = averageRankedAccuracy
		else console.log(JSON.stringify(dataUserChanges))
	}

	change = "category"
	if(dataUser[change] !== category) {
		register.addChange(change, category, "category")
		dataUserChanges[change] = category
		updateName = true
	}

	change = "scoresaberLastPP"
	if(dataUser[change].value !== scoresaberUser.stats.totalPP) {
		register.addChange(`${change}.value`, scoresaberUser.stats.totalPP, false, register.getLocalizationText("updateDebugPP"))
		dataUserChanges[change].value = scoresaberUser.stats.totalPP
		updateName = true
	}

	change = "scoresaberRank"
	if((dataUser[change]?.value ?? 0) !== scoresaberUser.stats.rank) {
		register.addChange(`${change}.value`, scoresaberUser.stats.rank, false)
		dataUserChanges[change] = { ...(dataUserChanges[change] ?? { lastFeed: 0, lastFeedDate: new Date() }), value: scoresaberUser.stats.rank }
	}

	change = "scoresaberCountryRank"
	if(countryChanged || (dataUser[change]?.value ?? 0) !== scoresaberUser.stats.countryRank) {
		// New country baseline must not look like a climb against the previous country's rank
		const lastFeed = countryChanged ? 0 : (dataUserChanges[change]?.lastFeed ?? dataUser[change]?.lastFeed ?? 0)
		register.addChange(`${change}.value`, scoresaberUser.stats.countryRank, false)
		if(countryChanged) register.addChange(`${change}.lastFeed`, 0, false)
		dataUserChanges[change] = {
			...(dataUserChanges[change] ?? { lastFeed: 0, lastFeedDate: new Date() }),
			value: scoresaberUser.stats.countryRank,
			lastFeed
		}
	}

	// Flush PP so region rank aggregation sees this user's latest PP
	if(register.changes["scoresaberLastPP.value"] != null) {
		await userSchema.updateOne(
			{ scoresaberID: dataUser.scoresaberID },
			{ "scoresaberLastPP.value": scoresaberUser.stats.totalPP }
		)
		delete register.changes["scoresaberLastPP.value"]
	}

	if(isFromMainCountry(getUserCountry(dataUserChanges, scoresaberUser.country))) {
		const regionRank = await getRank(dataUserChanges, "scoresaberLastPP.value", false, "descending", matchMainCountriesUsers())
		if(regionRank !== null && (dataUserChanges.mainCountriesRank?.value ?? 0) !== regionRank) {
			register.addChange("mainCountriesRank.value", regionRank, false)
			dataUserChanges.mainCountriesRank = {
				...(dataUserChanges.mainCountriesRank ?? { lastFeed: 0, lastFeedDate: new Date() }),
				value: regionRank
			}
		}
	} else if(dataUserChanges.mainCountriesRank && (dataUserChanges.mainCountriesRank.value !== 0 || dataUserChanges.mainCountriesRank.lastFeed !== 0)) {
		// Clear so rejoining main countries reseeds instead of firing a huge climb feed
		register.addChange("mainCountriesRank.value", 0, false)
		register.addChange("mainCountriesRank.lastFeed", 0, false)
		dataUserChanges.mainCountriesRank = { value: 0, lastFeed: 0, lastFeedDate: new Date() }
	}

	change = "discordName"
	if(discordMember && dataUser[change] !== discordMember.user.username) {
		register.addChange(change, discordMember.user.username, false)
		dataUserChanges[change] = discordMember.user.username
		updateName = true
	}

	change = "discordIsInServer"
	if(!discordMember && dataUser[change] !== false) {
		register.addChange(change, false, false)
		dataUserChanges[change] = false
	}
	
	if(discordMember && updateName && isDiscordCategories(category)) {
		register.debug.addText(register.getLocalizationText("updateDebugMemberChanges"), 1)

		const res = await discordUserUpdateHandler(discordMember, category, localization, dataUser, scoresaberUser)
		
		if(res != null) register.debug.addText(res, 1)
	}
	
	if(discordMember) {
		assignRankRoles(scoresaberUser, discordMember, dataUserChanges)
	}

	await register.editLevels(dataUser)

	return {
		changes: !isObjectEmpty(register.changes) ? register.changes : null,
		debugMessage: register.debug,
		newUser: dataUserChanges
	}
}
