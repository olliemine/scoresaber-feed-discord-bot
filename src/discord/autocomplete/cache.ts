import { ApplicationCommandOptionChoiceData } from "discord.js"

let cache: {[key: string]: {[key: string]: ApplicationCommandOptionChoiceData[]}} = {}

export function addSearch(id: string, type: string, obj: ApplicationCommandOptionChoiceData) {
	if(!cache[id]) cache[id] = {}
	if(!cache[id][type]) cache[id][type] = []
	
	cache[id][type] = cache[id][type].filter(value => value.name !== obj.name)
	cache[id][type].push(obj)
	
	if(cache[id][type].length > 25) cache[id][type].shift()
}

export function getMostRecent(id: string, type: string) {
	if(!cache[id] || !cache[id][type]) return []
	return cache[id][type].slice().reverse()
}