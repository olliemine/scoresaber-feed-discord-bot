import { isSaved } from "../discord/account/userFunctions.js"
import { level, levelPlayer, user, userMap } from "../types/db.js"
import levelSchema from "../models/levelSchema.js"
import { buildLeaderboardPlayer, buildLevelData, getBeatSaverFieldsFromPlay } from "../scoresaber/handlers/levelFormat.js"
import { UpdateQuery } from "mongoose"
import { isObjectEmpty } from "../misc/util.js"
import userSchema from "../models/userSchema.js"
import { logger } from "../logger.js"
import { LevelFeedUpdater } from "../feed/levelFeed.js"
import { getScore } from "./levelCounts.js"
import mongodb from "mongodb"
import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js"

const BULK_WRITE_CHUNK = 500

type LevelPlayerWithId = levelPlayer & { _id?: unknown }
type LeanLevel = level & { _id?: unknown }

function copyLevelPlayer(entry: LevelPlayerWithId): levelPlayer {
	return {
		playerID: entry.playerID,
		playerName: entry.playerName,
		category: entry.category,
		score: { ...entry.score },
		country: entry.country,
		date: new Date(entry.date),
		HMD: entry.HMD
	}
}

function copyLevelPlayerList(leaderboard: LevelPlayerWithId[]): levelPlayer[] {
	return leaderboard.map(copyLevelPlayer)
}

/** Plain level copy from lean query (no document / subdocument _ids). */
function levelFromLean(doc: LeanLevel): level {
	return {
		levelID: doc.levelID,
		hash: doc.hash,
		code: doc.code,
		isRanked: doc.isRanked,
		isDeleted: doc.isDeleted,
		positiveModifiers: doc.positiveModifiers,
		stars: doc.stars,
		maxScore: doc.maxScore,
		NPS: doc.NPS,
		BPM: doc.BPM,
		beatsaverLabels: [...doc.beatsaverLabels],
		difficultyInformation: { ...doc.difficultyInformation },
		leaderboard: copyLevelPlayerList(doc.leaderboard)
	}
}

function cloneLevelSnapshot(data: level): level {
	return {
		...data,
		beatsaverLabels: [...data.beatsaverLabels],
		difficultyInformation: { ...data.difficultyInformation },
		leaderboard: copyLevelPlayerList(data.leaderboard)
	}
}

const buildUserMap = (play: ScoreSaberPlay): userMap => {
	return {
		id: play.levelID,
		date: play.timeSet,
		name: play.songName,
		hash: play.hash,
		diff: play.difficulty,
		mode: play.modeName,
		pp: play.pp
	}
}

function getLastMap(plays: ScoreSaberPlay[]) {
	if (plays.length === 1) return buildUserMap(plays[0])
	const firstMapDate = plays[0].timeSet
	const lastMapDate = plays[plays.length - 1].timeSet
	if (firstMapDate.getTime() > lastMapDate.getTime()) return buildUserMap(plays[0])
	return buildUserMap(plays[plays.length - 1])
}

const getAllHMDs = (plays: ScoreSaberPlay[]): string[] => [...new Set(plays.map(a => a.hmdDevice))]

function checkIfAllHMDs(hmds: string[], newHmds: string[]) {
	for (const hmd of newHmds) {
		if (!hmds.includes(hmd)) return true
	}
	return false
}

function levelDocumentFromPlay(play: ScoreSaberPlay, dataUser: user): level {
	return buildLevelData(play, dataUser).toObject({ versionKey: false }) as level
}

function applyMissingLevelFields(data: level, play: ScoreSaberPlay) {
	const fromPlay = getBeatSaverFieldsFromPlay(play)

	if (fromPlay.code != null && data.code == null) data.code = fromPlay.code
	if (fromPlay.BPM != null && data.BPM == null) data.BPM = fromPlay.BPM
}

function applyPlayToLevel(
	data: level,
	dataUser: user,
	play: ScoreSaberPlay
): levelPlayer[] {
	const userScore = play.modifiedScore

	const oldLeaderboard = copyLevelPlayerList(data.leaderboard)

	const leaderboardWithoutPlayer = data.leaderboard.filter(
		p => p.playerID !== dataUser.scoresaberID
	)

	const newPositionFind = data.leaderboard
		.filter(p => p.playerID !== dataUser.scoresaberID)
		.findIndex(p => getScore(p, data.positiveModifiers) < userScore)

	const newPosition =
		newPositionFind === -1 ? leaderboardWithoutPlayer.length : newPositionFind

	data.leaderboard = leaderboardWithoutPlayer
	data.leaderboard.splice(newPosition, 0, buildLeaderboardPlayer(dataUser, play))

	applyMissingLevelFields(data, play)

	return oldLeaderboard
}

function levelUpdateSetFields(data: level): UpdateQuery<level> {
	const set: UpdateQuery<level> = {
		leaderboard: copyLevelPlayerList(data.leaderboard)
	}

	if (data.code != null) set.code = data.code
	if (data.BPM != null) set.BPM = data.BPM

	return set
}

async function flushBulkWrites(bulkOps: mongodb.AnyBulkWriteOperation<level>[]) {
	for (let i = 0; i < bulkOps.length; i += BULK_WRITE_CHUNK) {
		const chunk = bulkOps.slice(i, i + BULK_WRITE_CHUNK)
		const res = await levelSchema.bulkWrite(chunk, { ordered: true })

		if (!res.ok) throw new Error(`Mongo bulkwrite failed: ${res.getWriteConcernError()}`)
	}
}

export type levelRefreshDebugData = {
	player: string,
	newMaps: number,
	newPlays: number,
	getAverage: number
}

export async function levelRefresh(dataUser: user, plays: ScoreSaberPlay[]):
	Promise<{ debugData: levelRefreshDebugData } | null> {

	if (!isSaved(dataUser)) throw new Error(`User (${dataUser.scoresaberName}) shouldn't be saved`)

	if (!plays[0]) return null

	logger.debug(`Saving plays of ${dataUser.scoresaberName}, ${plays.length} new plays`)

	const debugData = {
		player: dataUser["scoresaberName"],
		newMaps: 0,
		newPlays: plays.length,
		getAverage: 0
	}

	const loopStart = Date.now()

	const levelIDs = [...new Set(plays.map(p => p.levelID))]
	const existing = await levelSchema.find({ levelID: { $in: levelIDs } }).lean()
	const existedAtStart = new Set(existing.map(l => l.levelID))
	const levelByID = new Map(existing.map(l => [l.levelID, levelFromLean(l as LeanLevel)]))

	const touchedLevelIDs = new Set<number>()
	const feedTasks: Array<() => Promise<void>> = []

	for (const play of plays) {
		let data = levelByID.get(play.levelID)

		if (!data) {
			data = levelDocumentFromPlay(play, dataUser)
			levelByID.set(play.levelID, data)
			touchedLevelIDs.add(play.levelID)
			debugData.newMaps++

			const levelSnapshot = cloneLevelSnapshot(data)
			feedTasks.push(() => LevelFeedUpdater.runNewMap(dataUser, levelSnapshot, play))
			continue
		}

		const oldLeaderboard = applyPlayToLevel(data, dataUser, play)
		touchedLevelIDs.add(play.levelID)

		const levelSnapshot = cloneLevelSnapshot(data)
		feedTasks.push(() => LevelFeedUpdater.runPlay(dataUser, levelSnapshot, oldLeaderboard, play))
	}

	debugData.getAverage = (Date.now() - loopStart) / plays.length / 1000

	const bulkOps: mongodb.AnyBulkWriteOperation<level>[] = []

	for (const levelID of touchedLevelIDs) {
		const data = levelByID.get(levelID)
		if (!data) continue

		if (existedAtStart.has(levelID)) {
			bulkOps.push({
				updateOne: {
					filter: { levelID },
					update: { $set: levelUpdateSetFields(data) }
				}
			})
		} else {
			bulkOps.push({ insertOne: { document: cloneLevelSnapshot(data) } })
		}
	}

	if (bulkOps.length) await flushBulkWrites(bulkOps)

	for (const runFeed of feedTasks) {
		await runFeed()
	}

	await getDataUserEdits(dataUser, plays, levelByID)

	return {
		debugData,
	}
}

async function getDataUserEdits(
	dataUser: user,
	plays: ScoreSaberPlay[],
	levelByID: Map<number, level>
) {
	const lastmap = getLastMap(plays)

	const userUpdate: UpdateQuery<user> = {}

	if (dataUser.scoresaberLastMap === null || lastmap.date.getTime() > dataUser.scoresaberLastMap?.date.getTime())
		userUpdate.scoresaberLastMap = lastmap

	const userTopPPPlay = dataUser?.scoresaberTopPlay?.pp ?? 0

	const playsTopPPPlay = plays.sort((a, b) => b.pp - a.pp)[0]

	if (playsTopPPPlay.pp > userTopPPPlay) {
		userUpdate.scoresaberTopPlay = buildUserMap(playsTopPPPlay)

		if (dataUser.scoresaberLastPP) {
			const topPlayMap = levelByID.get(playsTopPPPlay.levelID)
				?? await levelSchema.findOne({ levelID: playsTopPPPlay.levelID })

			if (topPlayMap) await LevelFeedUpdater.runTopPlay(dataUser, topPlayMap, playsTopPPPlay)
		}
	}

	const newHMDs = getAllHMDs(plays)

	if (!dataUser["scoresaberHMDs"] || checkIfAllHMDs(dataUser["scoresaberHMDs"], newHMDs))
		userUpdate["scoresaberHMDs"] = dataUser.scoresaberHMDs ? [...new Set([...dataUser.scoresaberHMDs, ...newHMDs])] : [...new Set(newHMDs)]

	if (isObjectEmpty(userUpdate)) return

	await userSchema.updateOne({ scoresaberID: dataUser.scoresaberID }, userUpdate).catch(logger.error)
}
