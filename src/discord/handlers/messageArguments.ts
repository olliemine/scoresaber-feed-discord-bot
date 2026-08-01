import invertBy from "lodash.invertby";
import { MAP_TAGS } from "../../types/external.js";

export function getMapTag(str?: string) {
	if(!str) return null

	const REVERSED_MAP_TAGS = invertBy(MAP_TAGS)
	const tag = str.trim()
	
	//@ts-ignore
	if(tag in MAP_TAGS) return { name: MAP_TAGS[tag], value: tag }
	if(REVERSED_MAP_TAGS[tag]) return { name: tag, value: REVERSED_MAP_TAGS[tag][0] }
	
	return null
}