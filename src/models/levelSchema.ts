import mongoose from "mongoose"
import { level } from "../types/db.js"

const RequiredString = {
	type: String,
	required: true
}

const RequiredNumber = { 
	type: Number, 
	required: true
}

const RequiredBoolean = {
	type: Boolean,
	required: true
}

const leaderboardPlayer = {
	"playerID": RequiredString,
	"playerName": RequiredString,
	"category": RequiredString,
	"score": {
		"scoreID": Number,
		"baseScore": RequiredNumber,
		"modifiedScore": RequiredNumber,
		"modifiers": [String],
		"FC": RequiredBoolean,
		"misses": RequiredNumber,
		"PP": Number
	},
	"country": RequiredString,
	"date": {
		type: Date,
		required: true
	},
	"HMD": RequiredString
}

const Level = new mongoose.Schema<level>({
	"levelID": {
		type: Number,
		required: true,
		unique: true
	},
	"hash": RequiredString,
	"code": String,
	"isRanked": RequiredBoolean,
	"isDeleted": RequiredBoolean,
	"positiveModifiers": RequiredBoolean,
	"stars": RequiredNumber,
	"maxScore": Number,
	"NPS": Number,
	"BPM": Number,
	"beatsaverLabels": Array,
	"difficultyInformation": {
		"difficultyNum": RequiredNumber,
		"modeName": RequiredString,
	},
	"leaderboard": [leaderboardPlayer]
})

let model = mongoose.model("Level", Level)
export default model