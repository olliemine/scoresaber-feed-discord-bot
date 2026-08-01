import { getIDFullFindString, getNameFindString } from "./links.js"
import {
	AnyScoreSaberUserBody,
	ScoreSaberPlayersSearch,
	ScoreSaberUserBodyBasic,
	ScoreSaberUserBodyFull
} from "../../types/scoresaber.js"
import userSchema from "../../models/userSchema.js"
import { nameFussySearch } from "../../discord/account/userFunctions.js"
import { fetchWithRetry, responseErrorString } from "../../misc/util.js"

export type SearchObject<TMultiple extends boolean, TPlayer = AnyScoreSaberUserBody> = {
	status: false,
	body: string
} | {
	status: true,
	body: TMultiple extends false ? TPlayer : TPlayer[]
}

export const getIDfromLink = (link: string) => {
	const match = link.match(/\d+/)
	return match ? match[0] : null
}

export const scoresaberLinkRegex = /^https:\/\/scoresaber\.com\/u\/[0-9]*(\?.*)?$/i

const DISCORD_MENTION_REGEX = /[<@!>]/g
const SCORESABER_ID_REGEX = /^\d+$/

function singleResult<TPlayer>(player: TPlayer): SearchObject<false, TPlayer> {
	return { status: true, body: player }
}

function multipleResult<TPlayer>(players: TPlayer[]): SearchObject<true, TPlayer> {
	return { status: true, body: players }
}

async function readPlayerResponse(res: Response, multiple: true): Promise<SearchObject<true>>
async function readPlayerResponse(res: Response, multiple: false): Promise<SearchObject<false>>
async function readPlayerResponse<TMultiple extends boolean>(res: Response, multiple: TMultiple): Promise<SearchObject<TMultiple>>
async function readPlayerResponse(res: Response, multiple: boolean): Promise<SearchObject<boolean>> {
	if(!res.ok) return {
		status: false,
		body: responseErrorString(res)
	}

	const body = await res.json() as ScoreSaberUserBodyFull | ScoreSaberPlayersSearch | { players?: ScoreSaberUserBodyBasic[] }

	// Full/basic profile endpoints return the player object directly
	if("id" in body && !("data" in body) && !("players" in body)) {
		return multiple ? multipleResult([body]) : singleResult(body)
	}

	let players: ScoreSaberUserBodyBasic[] = []
	if("data" in body && Array.isArray(body.data)) players = body.data
	else if("players" in body && Array.isArray(body.players)) players = body.players

	if(multiple) return multipleResult(players)

	if(!players[0]) return {
		status: false,
		body: "Player not found"
	}

	return singleResult(players[0])
}

export async function idSearch(id: string, multiple: true): Promise<SearchObject<true, ScoreSaberUserBodyFull>>
export async function idSearch(id: string, multiple: false): Promise<SearchObject<false, ScoreSaberUserBodyFull>>
export async function idSearch<T extends boolean>(id: string, multiple: T): Promise<SearchObject<T, ScoreSaberUserBodyFull>>
export async function idSearch(id: string, multiple: boolean): Promise<SearchObject<boolean, ScoreSaberUserBodyFull>> {
	if(!id) throw new Error("Invalid id provided.")

	const res = await fetchWithRetry(getIDFullFindString(id), { maxRetries: 10 })
	return readPlayerResponse(res, multiple) as Promise<SearchObject<boolean, ScoreSaberUserBodyFull>>
}

export async function nameSearch(name: string, multiple: true): Promise<SearchObject<true, ScoreSaberUserBodyBasic>>
export async function nameSearch(name: string, multiple: false): Promise<SearchObject<false, ScoreSaberUserBodyBasic>>
export async function nameSearch<T extends boolean>(name: string, multiple: T): Promise<SearchObject<T, ScoreSaberUserBodyBasic>>
export async function nameSearch(name: string, multiple: boolean): Promise<SearchObject<boolean, ScoreSaberUserBodyBasic>> {
	if(!name) throw new Error("Invalid name provided.")

	if(name.length < 3 || name.length > 32) return {
		status: false,
		body: "404 Invalid Name"
	}

	const res = await fetchWithRetry(getNameFindString(name))
	return readPlayerResponse(res, multiple) as Promise<SearchObject<boolean, ScoreSaberUserBodyBasic>>
}

export async function getScoresaberPlayer(str: string, multiple: true): Promise<SearchObject<true>>
export async function getScoresaberPlayer(str: string, multiple: false): Promise<SearchObject<false>>
export async function getScoresaberPlayer<T extends boolean>(str: string, multiple: T): Promise<SearchObject<T>>
export async function getScoresaberPlayer(str: string, multiple: boolean): Promise<SearchObject<boolean>> {
	if(!str) return {
		status: false,
		body: "Invalid Arguments"
	}

	if(scoresaberLinkRegex.test(str)) {
		const id = getIDfromLink(str)
		if(!id) return {
			status: false,
			body: "Invalid ScoreSaber link"
		}

		return idSearch(id, multiple)
	}

	const discordId = str.replace(DISCORD_MENTION_REGEX, "")
	const user = await userSchema.findOne({ discordID: discordId })
	if(user) return idSearch(user.scoresaberID, multiple)

	if(SCORESABER_ID_REGEX.test(str)) return idSearch(str, multiple)

	if(multiple) return nameSearch(str, true)

	const fuzzyUsers = await nameFussySearch(str)
	if(fuzzyUsers[0]) return idSearch(fuzzyUsers[0].scoresaberID, false)

	return nameSearch(str, false)
}
