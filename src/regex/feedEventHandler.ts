import { checkRegexOfMessage, regexLexicon } from "./regexLexicon.js"
import { isObjectEmpty } from "../misc/util.js"
import { DefaultChannelFeedConfiguration, RegexMessage } from "../types/config.js"
import { DEBUG_LEVELS, logger } from "../logger.js"

class EventConstruct {
	event: FeedsEnabled["events"][""] | null
	context: string | null
	feedsEnabled: FeedsEnabled
	feedMessages: {[key: string]: RegexMessage}

	constructor(event: FeedsEnabled["events"][""] | null, context: string | null, feedsEnabled: FeedsEnabled, feedMessages: {[key: string]: RegexMessage}) {
		this.event = event
		this.context = context
		this.feedsEnabled = feedsEnabled
		this.feedMessages = feedMessages
	}

	private isValidContext() {
		if(!this.event || !this.context) throw new Error(`Undefined class parameters`)
		
		const ValidContextes = getContextforEvent(this.event, this.feedsEnabled)
		
		for(const c of ValidContextes) {
			if(c === this.context) return true
		}

		return false
	}

	getFeedMessageProperty(): string {
		if(!this.event) throw new Error(`Undefined class parameters`)
		
		const combination = this.combine()
		if(this.feedMessages[combination]) return combination
		if(this.feedMessages[this.event.name]) return this.event.name
		throw new Error("No FeedMessage for " + combination + " was found")
	}

	getEventFromCombination(combination: string) {
		for(let eventProp in this.feedsEnabled.events) {
			const event = this.feedsEnabled.events[eventProp]
			if(!combination.startsWith(event.name)) continue
				
			const context = combination.substring(event.name.length)
			
			if(!context) {
				this.event = event
				this.context = null
				return
			}
			
			this.event = event
			this.context = context

			if(this.isValidContext() === false) throw new Error("Invalid combination: Invalid Context: " + context + " In Event: " + event.name)
			return 
		}

		throw new Error("Invalid combination: Event not found: " + combination)
	}

	combine() {
		if(!this.event) throw new Error(`Undefined class parameters`)
		return this.event.name + (this.context ? this.context : "")
	}
}

export function getEventFromCombination(combination: string, feedsEnabled: FeedsEnabled) {
	for(let eventProp in feedsEnabled.events) {
		const event = feedsEnabled.events[eventProp]
		if(!combination.startsWith(event.name)) continue
			
		return event
	}
	throw new Error("Invalid combination: Event not found: " + combination)
}

function getContextforEvent(event: FeedsEnabled["events"][""], feedsEnabled: FeedsEnabled): string[] {
	if(event?.customContext) return event.customContext
	return feedsEnabled.context
}

function getAllEventswithContextString(feedsEnabled: FeedsEnabled): string[] {
	let temp: string[] = []

	for (let eventProp in feedsEnabled.events) {
		getContextforEvent(feedsEnabled.events[eventProp], feedsEnabled).forEach(context => {
			temp.push(`${feedsEnabled.events[eventProp].name}${context}`)
		})
	}

	return temp
}

export interface FeedsEnabled {
	context: string[],
	events: {
		[key: string]: {
			name: string,
			customContext?: string[],
			[key: string]: unknown
		}
	}
}

export interface EventRegexes {
	regexLexicon: {[key: string]: regexLexicon | {
		every: string[]
	} & {
		[k: string]: regexLexicon
	}},
	events: {[key: string]: EventConstruct}
}

export function getEventRegexes(
	feeds: DefaultChannelFeedConfiguration[] | undefined,
	feedsEnabled: FeedsEnabled,
	feedMessages: {[key: string]: RegexMessage},
	simpleRegexes: string[],
	complexRegexes: RegExp[],
	{ifs = false, every = true, unique = false}
) : EventRegexes | null
{
	if(!feeds || feeds.length === 0) return null
	
	let data: EventRegexes = {
		regexLexicon: {},
		events: {}
	}
	
	let eventStrings: string[] = [] 

	for (let channelConfiguration of feeds) {
		if(channelConfiguration.Feeds === "all") {
			eventStrings = getAllEventswithContextString(feedsEnabled)
			break
		}

		eventStrings = eventStrings.concat(channelConfiguration.Feeds)
	}

	eventStrings = [...new Set(eventStrings)]

	let neededFeedMessages: string[] = []

	eventStrings.forEach(eventString => {
		function storeEvent(event: EventConstruct) {
			data.events[event.combine()] = event 
			neededFeedMessages.push(event.getFeedMessageProperty())
		}

		const eventConstruct = new EventConstruct(null, null, feedsEnabled, feedMessages)
		eventConstruct.getEventFromCombination(eventString)
		
		if(!eventConstruct.event) return

		if(eventConstruct.context) {
			storeEvent(eventConstruct)
			return
		}

		getContextforEvent(eventConstruct.event, feedsEnabled).forEach(context => {
			storeEvent(new EventConstruct(eventConstruct.event, context, feedsEnabled, feedMessages))
			return
		})
	})
	
	neededFeedMessages = [...new Set(neededFeedMessages)]

	if(neededFeedMessages.length === 0) return null

	logger.debug(`neededFeedMessages: ${neededFeedMessages}`, DEBUG_LEVELS.VARIABLE_DEBUG)

	neededFeedMessages.forEach((feedMessageProp) => {		
		const dataRegex = checkRegexOfMessage(feedMessages[feedMessageProp], feedMessageProp, simpleRegexes, complexRegexes, { ifs, unique, every })

		if(isObjectEmpty(dataRegex.regexLexicon)) return
		
		dataRegex.regexLexicon.every = dataRegex.every
		data.regexLexicon[feedMessageProp] = dataRegex.regexLexicon as regexLexicon | {
				every: string[];
			} & {
				[k: string]: regexLexicon;
			}		
	})
	
	return data
}