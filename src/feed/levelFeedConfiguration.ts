import getConfig from "../config/getConfig.js"
import { logger } from "../logger.js"
import { getEventFromCombination, getEventRegexes } from "../regex/feedEventHandler.js"
import { LevelFeedRegexes } from "../regex/regexes.js"

export const LEVEL_FEEDS = getConfig().database.maps.feed.feeds

export const LEVEL_FEEDS_ENABLED = {
	context: ["All", "MainCountries"],
	
	events: {
		NewMap: {
			name: "NewMap",
			type: "Score"
		},
		Top1: {
			name: "Top1",
			type: "Snipe"
		},
		Snipe: {
			name: "Snipe",
			type: "Snipe"
		},
		BetterPlay: {
			name: "BetterPlay",
			type: "Score"
		},
		BetterTopPlay: {
			name: "BetterTopPlay",
			type: "Score"
		},
		NewPlay: {
			name: "NewPlay",
			type: "Score"
		},
		TopPlay: {
			name: "TopPlay",
			type: "Score",
			customContext: [
				"Personal",
				"Country",
				"All",
				...Array.from({ length: 20 }, (_, i) => `Top${i + 1}`),
			],
		},
	}
}

export const levelFeedEventRegexes = getEventRegexes(
	LEVEL_FEEDS, 
	LEVEL_FEEDS_ENABLED, 
	getConfig().database.maps.feed.feedMessages ?? {}, 
	[],
	LevelFeedRegexes.getAllComplex(),
	{ ifs: true, unique: false, every: true }
)

function ifOnlyAvailableInSnipeEvents(regex: string) {
	const lowercase = regex.toLowerCase()
	if(lowercase.startsWith("snipe")) return true
	if(lowercase.startsWith("player") || lowercase.startsWith("level")) return false
	throw new Error("Unknown regex: " + lowercase)
}

if(levelFeedEventRegexes) for(let eventProp in levelFeedEventRegexes.events) {
	const event = levelFeedEventRegexes.events[eventProp]
	if(!event.event) continue

	const feedProperty = event.getFeedMessageProperty()

	if(!levelFeedEventRegexes.regexLexicon[feedProperty] || event.event.type === "Snipe") continue
	
	for (let regex of levelFeedEventRegexes.regexLexicon[feedProperty].every) {
		if(ifOnlyAvailableInSnipeEvents(regex)) {
			logger.fatal(`Regex ${regex} can not be used in a Score event ${event}`)
			throw new Error(`Regex ${regex} can not be used in a Score event ${event}`)
		}
	}
}

export function getLevelEventFromCombination(combination: string) {
	return getEventFromCombination(combination, LEVEL_FEEDS_ENABLED)
}
