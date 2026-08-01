import getConfig from "../config/getConfig.js"
import appContext from "../index.js"
import { user } from "../types/db.js"
import { getUserCountry } from "../discord/account/userFunctions.js"
import { top1CountRate } from "../db/levelPipelines.js"
import { languages } from "../languages/lang.js"
import { timeSince } from "../misc/time.js"

export type averageTop1CountRateArr = [("server" | "country"), (number | "rounded" | "ratio"), ("ranked" | undefined)]

export async function averageTop1CountRate(args: averageTop1CountRateArr, totalPlayedCount: number, rankedTotalPlayedCount: number, dataUser: user): Promise<string>
export async function averageTop1CountRate(args: averageTop1CountRateArr, totalPlayedCount: number, rankedTotalPlayedCount: number, id: string, country: string): Promise<string>
export async function averageTop1CountRate(args: averageTop1CountRateArr, totalPlayedCount: number, rankedTotalPlayedCount: number, idOrDataUser: string | user, country?: string): Promise<string> {		
	const context = args[0]
	const display = args[1]
	const ranked = args[2] === "ranked" ? true : false

	const id = typeof idOrDataUser === "string" ? idOrDataUser : idOrDataUser.scoresaberID
	country = typeof idOrDataUser === "string" ? country : getUserCountry(idOrDataUser)

	const count = await top1CountRate(id, country && context === "country" ? country : null, ranked)
	const totalCount = ranked ? rankedTotalPlayedCount : totalPlayedCount
	
	if(display === "ratio") return `${count} of ${totalCount}`

	const percentage = (count / totalCount) * 100

	if(display === "rounded") return Math.round(percentage).toString()
	if(+display) return percentage.toFixed(display > 20 ? 20 : display)
	return ""
}

export function decodePercent(args: [("round" | string)], num: number, maxValue = 8) {	
	const display = args[0]
	
	if(!display || !num) return "."
	if(+display) {
		const displayNum = parseInt(display)
		return num.toFixed(displayNum > maxValue ? maxValue : displayNum).toString()
	}
	return Math.round(num).toString()
}

export function dateFormats(type: string, date: Date, locale: languages): string {
	const lowerCaseType = type.toLowerCase()
	
	switch(lowerCaseType) {
		case "timeset":
			return `<t:${Math.floor(date.getTime() / 1000)}>`
		case "timesince":
			return `<t:${Math.floor(date.getTime() / 1000)}:R>`
		case "timesettext":
			return date.toLocaleDateString(getConfig().language, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
		case "timesincetext":
			return timeSince(date, 2, locale)
		default:
			return "."
	}
}

export function scoresaberRegexes(type: string, id: string, name: string) {
	switch(type) {
		case "id":
			return id
		case "name":
			return name
		case "link":
			return `https://scoresaber.com/u/${id}`
	}

	return ""
}

export function countryRegexes(type: string, countryCode: string) {
	if(!countryCode) return ""
	
	switch(type) {
		case "name":
			return appContext.regionNames.of(countryCode) ?? ""
		case "code":
			return countryCode
		case "flag":
			return `:flag_${countryCode.toLowerCase()}:`
	}

	return ""
}