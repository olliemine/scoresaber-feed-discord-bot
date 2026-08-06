import { getUserCountry } from "../../discord/account/userFunctions.js"
import { levelPlayer, user } from "../../types/db.js"
import levelSchema from "../../models/levelSchema.js"
import { ScoreSaberPlay } from "../../classes/scoreSaberPlay.js"

function getScore(play: ScoreSaberPlay): levelPlayer["score"] {	
	return {
		...(play.scoreID != null ? { scoreID: play.scoreID } : {}),
		"baseScore": play.unmodifiedScore,
		"modifiedScore": play.modifiedScore,
		"modifiers": play.modifiers,
		"FC": play.isFC,
		"misses": play.misses,
		"PP": play.pp
	}
}

export function buildLeaderboardPlayer(dataUser: user, play: ScoreSaberPlay): levelPlayer {
	return {
		"playerID": dataUser["scoresaberID"],
		"playerName": dataUser["scoresaberName"],
		"category": dataUser["category"],
		"score": getScore(play),
		"country": getUserCountry(dataUser),
		"date": play.timeSet,
		"HMD": play.hmdDevice
	}
}

export function buildLevelData(play: ScoreSaberPlay, dataUser: user) {	
	const level = new levelSchema({
		"levelID": play.levelID,
		"hash": play.hash,
		"isRanked": play.isRanked,
		"isDeleted": false,
		"positiveModifiers": play.positiveModifiers,
		"stars": play.stars,
		"maxScore": play.maxScore,
		"beatsaverLabels": [],
		"difficultyInformation": {
			"difficultyNum": play.difficulty,
			"modeName": play.modeName,
		},
		...(play.bsid != null ? { code: play.bsid } : {}),
		...(play.bpm != null ? { BPM: play.bpm } : {}),
	})

	level.leaderboard.push(buildLeaderboardPlayer(dataUser, play))

	return level
}

/** Fields ScoreSaber can supply without a BeatSaver lookup (mostly V2). */
export function getBeatSaverFieldsFromPlay(play: ScoreSaberPlay): { code?: string, BPM?: number } {
	return {
		...(play.bsid != null ? { code: play.bsid } : {}),
		...(play.bpm != null ? { BPM: play.bpm } : {}),
	}
}
