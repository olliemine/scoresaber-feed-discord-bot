import { User } from "discord.js";
import { user } from "../types/db.js";
import { isUserActive } from "../scoresaber/player/playerFunctions.js";
import getConfig from "../config/getConfig.js";
import userSchema from "../models/userSchema.js"
import { AnyScoreSaberUserBody } from "../types/scoresaber.js";

function seedRankFeedValues(scoresaberUser: AnyScoreSaberUserBody) {
	return {
		scoresaberRank: {
			value: scoresaberUser.stats.rank,
			lastFeed: 0,
			lastFeedDate: new Date()
		},
		scoresaberCountryRank: {
			value: scoresaberUser.stats.countryRank,
			lastFeed: 0,
			lastFeedDate: new Date()
		},
		scoresaberLastPP: {
			value: scoresaberUser.stats.totalPP,
			lastFeed: 0,
			lastFeedDate: new Date()
		}
	}
}

export default function createUser(scoresaberUser: AnyScoreSaberUserBody, category: user["category"], discordUser?: User) {
	const user = new userSchema({
		"scoresaberID": scoresaberUser.id,
		"scoresaberName": scoresaberUser.name,
		"scoresaberIsActive": isUserActive(scoresaberUser),
		"scoresaberCountry": scoresaberUser.country,
		"discordIsInServer": !!discordUser,
		"category": category,
		"configuration": {
			"doPingSnipe": getConfig().database["user-login"]["default-values"].doSnipePing
		},
		...seedRankFeedValues(scoresaberUser)
	}, )

	if(discordUser) {
		user.discordID = discordUser.id
		user.discordName = discordUser.username
	}
	
	return user
}

export function createUserID(scoresaberUser: AnyScoreSaberUserBody, category: user["category"], discordUser?: User) {
	const user: Partial<Pick<user, "scoresaberID" | "scoresaberName" | "scoresaberIsActive" | "scoresaberCountry" | "discordIsInServer" | "category" | "configuration" | "discordID" | "discordName" | "scoresaberRank" | "scoresaberCountryRank" | "scoresaberLastPP">> = {
		"scoresaberID": scoresaberUser.id,
		"scoresaberName": scoresaberUser.name,
		"scoresaberIsActive": isUserActive(scoresaberUser),
		"scoresaberCountry": scoresaberUser.country,
		"discordIsInServer": !!discordUser,
		"category": category,
		"configuration": {
			"doPingSnipe": getConfig().database["user-login"]["default-values"].doSnipePing
		},
		...seedRankFeedValues(scoresaberUser)
	}
	if(discordUser) {
		user.discordID = discordUser.id
		user.discordName = discordUser.username
	}
	
	return user
}