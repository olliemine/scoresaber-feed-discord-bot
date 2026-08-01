import getConfig from "../config/getConfig.js"
import { logger } from "../logger.js"
import { imageUrlToBase64 } from "../misc/util.js"
import { level } from "../types/db.js"
import { LevelDifficulties } from "../types/external.js"

function generateDifficulty(map: Pick<level, "difficultyInformation"> & {
	[x: string]: unknown
}) {
	const name = LevelDifficulties.Array.find(a => a.Number === map.difficultyInformation.difficultyNum)?.FullName
	if(!name) throw new Error(`Map (${map.hash}) has invalid number difficulty (${map.difficultyInformation.difficultyNum})`)
	
	return {
		"characteristic": map.difficultyInformation.modeName,
		"name": name
	}
}

export type PlaylistLevel = Pick<level, "levelID" | "hash" | "code" | "difficultyInformation" | "isDeleted"> & { [x: string]: unknown }

function generatePlaylist(maps: PlaylistLevel[], playlistName: string, playlistImage: string | null) {
	let playlistData: {
		playlistTitle: string,
		playlistAuthor: string,
		songs: {
			hash: string,
			code: string,
			difficulties: {
				characteristic: string,
				name: string
			}[]
		}[],
		image?: string
	} = {
		"playlistTitle": playlistName,
		"playlistAuthor": getConfig().botAuthor,
		"songs": []
	}

	maps.forEach(map => {
		if(map["isDeleted"] === true || !map.code) return
		const index = playlistData.songs.findIndex(obj => obj.hash === map.hash)

		if(index !== -1) {
			return playlistData.songs[index].difficulties.push(generateDifficulty(map))
		}

		playlistData.songs.push({
			"hash": map.hash,
			"code": map.code,
			"difficulties": [generateDifficulty(map)]
		})
	})

	if(playlistData.songs[0] == null) throw new Error("No maps found (or maps without codes)")

	if(playlistImage) playlistData.image = playlistImage
	
	return playlistData
}

async function URLtoBase64(URL: string | null) {
	if(!URL) return null
	
	const base64Data = await imageUrlToBase64(URL).catch((err) => {
		logger.error(err)
	})

	if(base64Data == null) return null
	return `base64,${base64Data}`
}

export { generatePlaylist, URLtoBase64 }
