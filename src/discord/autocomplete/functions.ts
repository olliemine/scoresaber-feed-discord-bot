import invertBy from "lodash.invertby"
import FuseImport from "fuse.js"
import { AutocompleteInteraction } from "discord.js"
import { getMostRecent } from "./cache.js"
import { nameFussySearch } from "../account/userFunctions.js"
import { logger } from "../../logger.js"
import { user } from "../../types/db.js"
import { MAP_TAGS } from "../../types/external.js"

// fuse.js types are not constructable under moduleResolution node16
const Fuse = FuseImport as unknown as {
	new <T>(list: ReadonlyArray<T>): { search(pattern: string): Array<{ item: T }> }
}

async function sendUsersAutocomplete(users: user[], interaction: AutocompleteInteraction) {
	if(users.length === 0) return interaction.respond([])
	
	const focusedValue = interaction.options.getFocused()
	
	let response = [{ name: focusedValue, value: focusedValue }]
	users.forEach(user => response.push({ name: user["scoresaberName"], value: user["scoresaberID"] }))

	response.length = Math.min(response.length, 25)
	await interaction.respond(response)
}

export async function dataUserAutocomplete(interaction: AutocompleteInteraction) {
	const focusedValue = interaction.options.getFocused().trim()
	
	if(!focusedValue) {
		return interaction.respond(getMostRecent(interaction.user.id, "dataUser"))
	}
	
	try {
		const data = await nameFussySearch(focusedValue, {
			$project: {
				scoresaberName: 1,
				scoresaberID: 1
			}
		})
		await sendUsersAutocomplete(data, interaction)
	} catch(err) {
		logger.unknownError(err)
		if(!interaction.responded) await interaction.respond([])
	}
}

export async function mapTagAutocomplete(interaction: AutocompleteInteraction) {
	const focusedValue = interaction.options.getFocused()
	
	if(!focusedValue) {
		return interaction.respond(getMostRecent(interaction.user.id, "mapTag"))
	}
	
	const lastTag = focusedValue.trim()
	
	const INVERTED_MAP_TAGS = invertBy(MAP_TAGS)

	if(INVERTED_MAP_TAGS[lastTag] != null) return await interaction.respond([{ name: lastTag, value: INVERTED_MAP_TAGS[lastTag][0] }])

	if(!lastTag || INVERTED_MAP_TAGS[lastTag] != null) return interaction.respond([])

	const fuse = new Fuse(Object.values(MAP_TAGS))

	const results = fuse.search(lastTag)

	results.length = Math.min(results.length, 5)

	const autocompleteValues = 
	results.map(result => 
		({ name: result.item,
		value: INVERTED_MAP_TAGS[result.item][0] }))
	return await interaction.respond(autocompleteValues)
}