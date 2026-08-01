import { PipelineStage } from "mongoose"
import { languageString } from "../languages/lang.js"
import { isObjectEmpty } from "../misc/util.js"
import { getPlaysUnknownPlayer } from "../scoresaber/handlers/getPlaysUnknownPlayer.js"
import { level, user } from "../types/db.js"
import levelSchema from "../models/levelSchema.js"
import { getScore } from "../update/levelCounts.js"

export type PlaylistFilters = {
	limit: number,
	ranked: boolean,
	minNPS: number,
	maxNPS: number,
	minDateTime: Date | null,
	maxDateTime: Date | null,
	minStars: number,
	maxStars: number,
	tag: string | null
}

export type PipelineProjection = {[key in keyof Partial<level>]: 0 | 1}

export const defaultFilterPipelineProjection: PipelineProjection = {
	"levelID": 1,
	"hash": 1,
	"code": 1,
	"difficultyInformation": 1,
	"isDeleted": 1
}

export function filterPipeline(
	filters: PlaylistFilters,
	getDateOfPlay?: { $addFields: { playDate: string }},
	beforePipeline?: PipelineStage[],
	afterPipeline?: PipelineStage[],
	project: Omit<PipelineProjection, "levelID" | "hash" | "code" | "difficultyInformation" | "isDeleted"> = {}
): [null, languageString] | [PipelineStage[], null] {
	let aggregationPipeline: PipelineStage[] = [{ $match: { isDeleted: false }}]
	let match: {[key: string]: any} = {}
	
	if(beforePipeline) aggregationPipeline = [...aggregationPipeline, ...beforePipeline]

	if(typeof filters.minDateTime === "number" && isNaN(filters.minDateTime)) return [null, "playlistInvalidMinDate"]

	if(typeof filters.maxDateTime === "number" && isNaN(filters.maxDateTime)) return [null, "playlistInvalidMaxDate"]

	if(filters.maxNPS !== 0 && filters.minNPS > filters.maxNPS) return [null, "playlistMinNPSNotGreaterThanMaxNPS"]
	if(filters.maxStars !== 0 && filters.minStars > filters.maxStars) return [null, "playlistMinStarsNotGreaterThanMaxStars"]
	if(filters.maxDateTime != null && filters.minDateTime != null && filters.minDateTime.getTime() > filters.maxDateTime.getTime()) return [null, "playlistMinDateNotGreaterThanMaxDate"]

	if(filters.ranked) match.isRanked = true
	
	if(filters.minNPS !== 0 || filters.maxNPS !== 0) match.NPS = {}
	if(filters.minNPS !== 0) match.NPS.$gte = filters.minNPS
	if(filters.maxNPS !== 0) match.NPS.$lte = filters.maxNPS

	if(getDateOfPlay && (filters.maxDateTime != null || filters.minDateTime != null)) {
		aggregationPipeline.push(getDateOfPlay)
		match.playDate = {}
	}
	if(getDateOfPlay && filters.minDateTime) match.playDate.$gte = filters.minDateTime.toISOString() 
	if(getDateOfPlay && filters.maxDateTime) match.playDate.$lte = filters.maxDateTime.toISOString() 

	if(filters.minStars !== 0 || filters.maxStars !== 0) match.stars = {}
	if(filters.minStars !== 0) match.stars.$gte = filters.minStars
	if(filters.maxStars !== 0) match.stars.$lte = filters.maxStars

	if(filters.tag) match.beatsaverLabels = filters.tag

	if(!isObjectEmpty(match)) aggregationPipeline.push({$match: match})
	
	if(afterPipeline) aggregationPipeline = [...aggregationPipeline, ...afterPipeline]
	
	aggregationPipeline.push(
		{ $limit: filters.limit },
		{ $project: {...defaultFilterPipelineProjection, ...project} }
	)

	return [aggregationPipeline, null]
}

export async function getSnipedPlaysUnknownPlayer(
	filters: PlaylistFilters,
	dataUser: user,
	unknownPlayerID: string
): Promise<[Pick<level, "levelID" | "leaderboard" | "hash" | "code" | "difficultyInformation" | "positiveModifiers" | "isDeleted">[], null] | [null, languageString]> {
	const playerScores = await getPlaysUnknownPlayer(unknownPlayerID)
	
	if(!playerScores || !playerScores[0]) return [null, "playlistNoMapFound"]

	const [aggregationPipeline, error] = filterPipeline(filters, undefined, [{
		$match: {
			"levelID": { $in: playerScores.map(p => p.levelID) },
			"leaderboard.playerID": dataUser.scoresaberID
		}
	}], undefined, { leaderboard: 1, positiveModifiers: 1 })

	if(error) return [null, error]

	let maps = await levelSchema.aggregate(aggregationPipeline) as Pick<level, "levelID" | "leaderboard" | "hash" | "code" | "difficultyInformation" | "positiveModifiers" | "isDeleted">[]

	maps = maps.filter((map) => {
		const playerScore = playerScores.find(p => p.levelID === map.levelID)
		const dataUserScore = map.leaderboard.find(p => p.playerID === dataUser.scoresaberID)

		if(!playerScore || !dataUserScore) throw new Error(`User not found`)

		return playerScore.modifiedScore > getScore(dataUserScore, map.positiveModifiers)
	})

	if(filters.minDateTime || filters.maxNPS) maps = maps.filter(map => {
		const playerScore = playerScores.find(p => p.levelID === map.levelID)
		
		if(!playerScore) return false
		
		let filter = true

		if(filters.minDateTime) filter = playerScore.timeSet.getTime() >= filters.minDateTime.getTime()

		if(filter === false) return false

		if(filters.maxDateTime) filter = playerScore.timeSet.getTime() <= filters.maxDateTime.getTime()

		return filter
	})

	return [maps, null]
}