import mongoose from "mongoose"
import { user } from "../types/db.js"

const RequiredString = {
	type: String,
	required: true
}

const RequiredBoolean = {
	type: Boolean,
	required: true
}

const RequiredNumber = {
	type: Number,
	required: true
}

const NumberFeedValue = {
	value: {
		type: Number,
		default: 0
	},
	
	lastFeed: {
		type: Number,
		default: 0
	},

	lastFeedDate: {
		type: Date,
		default: Date.now
	}
}

const UserSchema = new mongoose.Schema<user>({
	"scoresaberID": {
		type: String,
		required: true,
		unique: true
	}, 
	"scoresaberName": RequiredString, 
	"scoresaberIsActive": RequiredBoolean, 
	"scoresaberCountry": RequiredString,
	"unofficialCountry": String,
	
	"discordIsInServer": RequiredBoolean,
	"category": RequiredString,
	"discordID": String,
	"discordName": String,
	"discordServerNickname": String, 
	
	"scoresaberLastAverageAccuracy": NumberFeedValue,
	"scoresaberLastPP": NumberFeedValue,
	"scoresaberRank": NumberFeedValue,
	"scoresaberCountryRank": NumberFeedValue,
	"mainCountriesRank": NumberFeedValue,
	
	"scoresaberHMDs": {
		type: Array,
		default: []
	},
	
	"totalPlayedCount": {
		type: Number,
		default: 0
	},

	"top1Single": NumberFeedValue,
	"top1Multi": NumberFeedValue,

	"top1Single-porcent": NumberFeedValue,
	"top1Multi-porcent": NumberFeedValue,
	
	"scoresaberLastMap": {
		type: {},
		default: null
	},

	"scoresaberTopPlay": {
		type: {},
		default: null
	},

	"graphs": [],
	
	"configuration": {
		"doPingSnipe": {
			type: Boolean,
			default: false
		}
	}
})

let model = mongoose.model("users", UserSchema)
export default model