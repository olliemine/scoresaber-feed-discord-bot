import appContext from "../index.js"
import getConfig from "../config/getConfig.js"
import { logger } from "../logger.js"
import { DefaultChannelFeedConfiguration } from "../types/config.js"

export function includesEvent(
	combination: string,
	channelConfiguration: DefaultChannelFeedConfiguration,
	resolveEvent: (combination: string) => { name: string }
) {
	if(channelConfiguration.Feeds === "all") return true

	const event = resolveEvent(combination)
	return !!channelConfiguration.Feeds.filter(value => value === event.name)[0]
		|| !!channelConfiguration.Feeds.filter(value => value === combination)[0]
}

export function resolveFeedChannel(channelId: string) {
	const guild = appContext.discordClient.guilds.cache.get(getConfig()["server-id"])

	if(!guild) throw new Error("Server not found")

	const channel = guild.channels.cache.get(channelId)

	if(!channel) {
		logger.warn(`Channel (ID: ${channelId}) not found in server (ID: ${getConfig()["server-id"]})`)
		return undefined
	}

	return channel
}
