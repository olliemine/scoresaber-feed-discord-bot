import getConfig from "../config/getConfig.js"
import { MapChannelFeedConfiguration } from "../types/config.js"
import { LEVEL_FEEDS_ENABLED } from "../feed/levelFeedConfiguration.js"
import levelSchema from "../models/levelSchema.js"
import { PipelineStage } from "mongoose"
import { level } from "../types/db.js"

export function parseMapFeed(feed: string) {
	for(const eventName of Object.keys(LEVEL_FEEDS_ENABLED.events)) {
		if(feed.startsWith(eventName)) {
			return { eventName, context: feed.slice(eventName.length) || "All" }
		}
	}
	return { eventName: feed, context: "All" }
}

function rankedMatch(channelConfiguration: MapChannelFeedConfiguration): Record<string, unknown> {
	const type = channelConfiguration.Types?.toLowerCase()
	if(type === "ranked") return { isRanked: true }
	if(type === "unranked") return { isRanked: false }
	return {}
}

function ppMatch(channelConfiguration: MapChannelFeedConfiguration, scorePath: string): PipelineStage[] {
	const stages: PipelineStage[] = []
	if(channelConfiguration.minPP != null) {
		stages.push({ $match: { [scorePath]: { $gte: channelConfiguration.minPP } } })
	}
	if(channelConfiguration.maxPP != null) {
		stages.push({ $match: { [scorePath]: { $lt: channelConfiguration.maxPP } } })
	}
	return stages
}

function contextualLeaderboardField(context: string) {
	const mainCountries = getConfig()["main-countries"]
	if(context !== "MainCountries") {
		return { contextualLeaderboard: "$leaderboard" }
	}
	return {
		contextualLeaderboard: {
			$filter: {
				input: "$leaderboard",
				as: "p",
				cond: { $in: ["$$p.country", mainCountries] }
			}
		}
	}
}

function eventMatchStages(eventName: string, channelConfiguration: MapChannelFeedConfiguration): PipelineStage[] {
	const top1IfNoUsers = getConfig().database.maps.feed.top1IfNoUsers === true

	switch(eventName) {
		case "Top1":
		case "Snipe":
			return [
				{ $match: { $expr: { $gte: [{ $size: "$contextualLeaderboard" }, top1IfNoUsers ? 1 : 2] } } },
				...(top1IfNoUsers ? [] : [{ $match: { "contextualLeaderboard.1": { $exists: true } } }])
			]
		case "BetterTopPlay":
			return [
				{ $match: { $expr: { $gte: [{ $size: "$contextualLeaderboard" }, top1IfNoUsers ? 1 : 2] } } },
				{ $match: { "contextualLeaderboard.0": { $exists: true } } }
			]
		case "NewMap":
			return [
				{ $match: { $expr: { $lte: [{ $size: "$leaderboard" }, 8] } } },
				{ $match: { "contextualLeaderboard.0": { $exists: true } } }
			]
		case "NewPlay":
		case "BetterPlay":
			return [
				{ $match: { $expr: { $gte: [{ $size: "$contextualLeaderboard" }, 1] } } }
			]
		default:
			if(eventName.startsWith("TopPlay")) {
				return [
					{ $match: { "contextualLeaderboard.0": { $exists: true } } }
				]
			}
			return [
				{ $match: { $expr: { $gte: [{ $size: "$contextualLeaderboard" }, 1] } } }
			]
	}
}

/**
 * Find the first level document in Mongo that fits this map feed + channel gates.
 */
export async function findCompatibleLevel(
	feed: string,
	channelConfiguration: MapChannelFeedConfiguration
): Promise<(level & { contextualLeaderboard: level["leaderboard"] }) | null> {
	const { eventName, context } = parseMapFeed(feed)

	const pipeline: PipelineStage[] = [
		{ $match: { isDeleted: false, ...rankedMatch(channelConfiguration) } },
		{ $addFields: contextualLeaderboardField(context) },
		...eventMatchStages(eventName, channelConfiguration),
		...ppMatch(channelConfiguration, "contextualLeaderboard.0.score.PP"),
		{ $limit: 1 }
	]

	const results = await levelSchema.aggregate(pipeline)
	return results[0] ?? null
}
