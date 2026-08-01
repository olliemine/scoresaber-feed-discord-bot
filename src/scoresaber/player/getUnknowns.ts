import getConfig from "../../config/getConfig.js"
import { ScoreSaberPlayersSearch, ScoreSaberUserBodyBasic } from "../../types/scoresaber.js"
import userSchema from "../../models/userSchema.js"
import createUser from "../../db/createUser.js"
import mongodb from "mongodb"
import { getCountryPage } from "../handlers/links.js"
import { UPDATE_RESULT, UPDATE_STATUS } from "../../types/util.js"
import TakeTime from "../../classes/takeTime.js"

export default async function getUnknowns(): Promise<UPDATE_RESULT> {
	const changes = new TakeTime("SaveUnknowns")
	
	if(!getConfig().database.players.Unknowns.SaveUnknowns) return {
		result: UPDATE_STATUS.NO_UPDATE,
		status: changes.addText("Application configured to not save unknowns", 1) 
	}
	
	const countries = getConfig()["main-countries"].join(",")

	let counter = 0
	
	let newPlayers: ScoreSaberUserBodyBasic[] = []
	let bulkWriteData: mongodb.AnyBulkWriteOperation[] = []
	
	let times: number[] = []

	while(true) {
		counter++
		const startTime = Date.now()

		const res = await fetch(getCountryPage(counter.toString(), countries))

		if(res.status !== 200) break

		const body = await res.json() as ScoreSaberPlayersSearch

		const players = body.data

		if(!players) return {
			result: UPDATE_STATUS.ERROR, 
			status: changes.addText(`Unexpected API response: ${JSON.stringify(body)}`, 1)
		}

		let foundPPLimit = false

		for (let i = 0; i < players.length; i++) {			
			const scoresaberUser = players[i]
			const totalPP = scoresaberUser.stats.totalPP

			if(totalPP < getConfig().database.players.update.ppLimit) {
				foundPPLimit = true
				continue
			}

			const exists = await userSchema.exists({ "scoresaberID": scoresaberUser.id })

			if(!exists) {
				newPlayers.push(scoresaberUser)
				continue
			}
		}

		times.push(Date.now() - startTime)

		if(foundPPLimit) break
	}

	for (const player of newPlayers) {
		const newUser = createUser(player, "Unknown")
		bulkWriteData.push({ insertOne: { document: newUser} })
		changes.addText(`User ${newUser.scoresaberName} saved as Unknown`, 1)
	}

	if(bulkWriteData.length === 0) return {
		result: UPDATE_STATUS.NO_UPDATE
	}

	if(times.length) {
		changes.addText(`Average page checkup: ${((times.reduce((acc, value) => acc += value, 0) / times.length) / 1000).toFixed(2)}s`, 0)
	}

	changes.addText(`Synced ${bulkWriteData.length} main-countries leaderboard entries (${newPlayers.length} new)`, 0)

	await userSchema.bulkWrite(bulkWriteData)

	return {
		result: UPDATE_STATUS.SUCCESS,
		status: changes
	}
}
