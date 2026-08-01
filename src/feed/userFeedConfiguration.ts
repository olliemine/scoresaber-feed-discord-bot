import getConfig from "../config/getConfig.js"
import { FeedsEnabled, getEventFromCombination, getEventRegexes } from "../regex/feedEventHandler.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { RegexMessage } from "../types/config.js"

export const USER_FEEDS = getConfig().database.players.feed.feeds

export const USER_FEEDS_ENABLED: FeedsEnabled = {
	context: ["All", "MainCountries"],
	events: {
		GlobalRank: {
			name: "GlobalRank"
		},

		CountryRank: {
			name: "CountryRank"
		},

		MainCountriesRank: {
			name: "MainCountriesRank"
		},

		Top1QuantityMaps: {
			name: "Top1QuantityMaps"
		},

		Top1PercentageMaps: {
			name: "Top1PercentageMaps"
		},

		AverageAccuracy: {
			name: "AverageAccuracy"
		},
	}
}

const PLAYER_REGEX = /{(Sniped|Player)_(name|scoresaber_(id|name|link)|discordName|country_(name|code|flag)|currentRank|lastRank|timeSet|timeSince|timeSetText|timeSinceText|globalRank|countryRank|variable|lastVariable)}/g
const BASIC_REGEXES = ["SnipedUsers", "Update_block", "SnipedUsersExceptFirst"]

export const userFeedEventRegexes = USER_FEEDS && getConfig().database.players.feed.feedMessages ?
	getEventRegexes(
		USER_FEEDS,
		USER_FEEDS_ENABLED,
		getConfig().database.players.feed.feedMessages as { [k: string]: RegexMessage },
		BASIC_REGEXES,
		[PLAYER_REGEX],
		{ ifs: true, unique: false, every: true}
	) : null

if(userFeedEventRegexes === null) logger.debug("playerFeed not activated", DEBUG_LEVELS.INCEPTION_DEBUG)

export function getUserEventFromCombination(combination: string) {
	return getEventFromCombination(combination, USER_FEEDS_ENABLED)
}
