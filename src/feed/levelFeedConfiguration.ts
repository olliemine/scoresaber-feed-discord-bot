import getConfig from "../config/getConfig.js"
import { logger } from "../logger.js"
import { getEventFromCombination, getEventRegexes } from "../regex/feedEventHandler.js"

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
			customContext: ["Personal", "Country", "All"],
		},
	}
}

const PLAYER_REGEX = /{Player_(A|B)_(ID|name|link|country_(name|code|flag)|databaseRank|baseScore|modifiedScore|baseScorePercentage|modifiedScorePercentage|score|scorePercentage|modifiers|missCount|isFC|misses|scorePP|scoreWeightedPP|timeSet|timeSince|HMD|(averageTop1CountRate_(server|country)_(\d|rounded|ratio)(_ranked)?)|timeSetText|timeSinceText|oldBaseScore|oldModifiedScore|oldBaseScorePercentage|oldModifiedScorePercentage|oldScore|oldScorePercentage|oldModifiers|oldMissCount|oldIsFC|oldMisses|oldScorePP|oldTimeSet|oldTimeSince|oldTimeSetText|oldTimeSinceText|scoreDifference|scoreDifferencePercentage)}/g
const LEVEL_REGEX = /{Level_(scoresaberLink|beatsaverLink|code|songName|songSubName|songAuthorName|mapperName|difficulty|difficultyFormated|difficultyTiny|difficultyTiniest|gameMode|ranked|stars|creationDate|creationSince)}/g
const SNIPE_REGEX = /{Snipe_(differenceScore|differenceScorePercentage)}/g

export const levelFeedEventRegexes = getEventRegexes(
	LEVEL_FEEDS, 
	LEVEL_FEEDS_ENABLED, 
	getConfig().database.maps.feed.feedMessages ?? {}, 
	[],
	[PLAYER_REGEX, LEVEL_REGEX, SNIPE_REGEX],
	{ ifs: true, unique: false, every: true }
)

function ifOnlyAvailableInSnipeEvents(regex: string) {
	if(regex.startsWith("Snipe")) return true
	if(regex.startsWith("Player") || regex.startsWith("Level")) return false
	throw new Error("Unknown regex: " + regex)
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
