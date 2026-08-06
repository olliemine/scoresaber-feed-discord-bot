import { DefaultChannelFeedConfiguration, MapChannelFeedConfiguration } from "../types/config.js"
import { getAllEventswithContextString } from "../regex/feedEventHandler.js"
import { LEVEL_FEEDS, LEVEL_FEEDS_ENABLED, levelFeedEventRegexes, getLevelEventFromCombination } from "../feed/levelFeedConfiguration.js"
import { USER_FEEDS, USER_FEEDS_ENABLED, userFeedEventRegexes, getUserEventFromCombination } from "../feed/userFeedConfiguration.js"
import { includesEvent, resolveFeedChannel } from "../feed/feedCommon.js"
import getConfig from "../config/getConfig.js"

const PLAYER_EVENT_NAMES = new Set(Object.keys(USER_FEEDS_ENABLED.events))

function collectFeedStrings(
	feeds: DefaultChannelFeedConfiguration[] | undefined,
	feedsEnabled: { context: string[], events: Record<string, { name: string }> }
): string[] {
	if(!feeds?.length) return []

	const strings = new Set<string>()
	for(const channelConfiguration of feeds) {
		if(channelConfiguration.Feeds === "all") {
			getAllEventswithContextString(feedsEnabled).forEach(s => strings.add(s))
			continue
		}
		channelConfiguration.Feeds.forEach(s => strings.add(s))
	}
	return [...strings]
}

export function getEnabledFeedStrings(): string[] {
	const mapFeeds = collectFeedStrings(LEVEL_FEEDS, LEVEL_FEEDS_ENABLED)
	const playerFeeds = collectFeedStrings(USER_FEEDS, USER_FEEDS_ENABLED)
	return [...new Set([...mapFeeds, ...playerFeeds])].sort()
}

export type ResolvedFeed = {
	kind: "map" | "player",
	event: string,
	channelConfiguration: DefaultChannelFeedConfiguration
}

function resolveFromFeeds(
	feed: string,
	feeds: DefaultChannelFeedConfiguration[] | undefined,
	kind: "map" | "player"
): ResolvedFeed | null {
	if(!feeds?.length) return null

	for(const channelConfiguration of feeds) {
		const resolveEvent = kind === "map" ? getLevelEventFromCombination : getUserEventFromCombination
		if(!includesEvent(feed, channelConfiguration, resolveEvent)) continue
		return { kind, event: feed, channelConfiguration }
	}
	return null
}

export function resolveFeed(feed: string): ResolvedFeed {
	if(isPlayerFeedEvent(feed)) {
		const playerMatch = resolveFromFeeds(feed, USER_FEEDS, "player")
		if(!playerMatch) throw new Error(`Feed "${feed}" is not enabled in player feed config.`)
		if(!userFeedEventRegexes?.events[feed]) {
			throw new Error(`Feed "${feed}" has no player feedMessages template.`)
		}
		return playerMatch
	}

	const mapMatch = resolveFromFeeds(feed, LEVEL_FEEDS, "map")
	if(!mapMatch) throw new Error(`Feed "${feed}" is not enabled in map feed config.`)
	if(!levelFeedEventRegexes?.events[feed]) {
		throw new Error(`Feed "${feed}" has no map feedMessages template.`)
	}
	return mapMatch
}

export function getMapChannelConfiguration(feed: string): MapChannelFeedConfiguration | null {
	const resolved = resolveFromFeeds(feed, LEVEL_FEEDS, "map")
	return resolved?.channelConfiguration as MapChannelFeedConfiguration ?? null
}

export function assertFeedChannelResolvable(channelConfiguration: DefaultChannelFeedConfiguration) {
	const channel = resolveFeedChannel(channelConfiguration.Channel)
	if(!channel) throw new Error(`Configured feed channel ${channelConfiguration.Channel} was not found.`)
}

export function isPlayerFeedEvent(feed: string) {
	for(const name of PLAYER_EVENT_NAMES) {
		if(feed.startsWith(name)) return true
	}
	return false
}

export function getMainCountries() {
	return getConfig()["main-countries"]
}
