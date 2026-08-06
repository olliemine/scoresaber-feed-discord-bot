const averageTop1CountRateMatch = "averageTop1CountRate_(server|country)_(\\d|rounded|ratio)(_ranked)?"

export class LevelFeedRegexes {
	private static readonly BASE_PLAYER_PROPERTIES = [
		"ID", "name", "link", "country_name", "country_code", "country_flag", "databaseRank", "baseScore", "modifiedScore", "baseScorePercentage",
		"modifiedScorePercentage", "score", "scorePercentage", "modifiers", "missCount", "isFC", "misses", "scorePP", "scoreWeightedPP", "timeSet",
		"timeSince", "HMD", "timeSetText", "timeSinceText", "oldBaseScore", "oldModifiedScore", "oldBaseScorePercentage", "oldModifiedScorePercentage",
		"oldScore", "oldScorePercentage", "oldModifiers", "oldMissCount", "oldIsFC", "oldMisses", "oldScorePP", "oldTimeSet", "oldTimeSince", "oldTimeSetText",
		"oldTimeSinceText", "scoreDifference", "scoreDifferencePercentage", "rank", "countryRank", "leaderboardRank"
	] as const

	private static readonly LEVEL_PROPERTIES = [
		"scoresaberLink", "beatsaverLink", "code", "songName", "songSubName", "songAuthorName", "mapperName", "difficulty", "difficultyFormated",
		"difficultyTiny", "difficultyTiniest", "gameMode", "ranked", "stars", "creationDate", "creationSince"
	] as const

	private static readonly SNIPE_PROPERTIES = [
		"differenceScore", "differenceScorePercentage"
	] as const

	public static getAllComplex() {
		const basePlayerProps = this.BASE_PLAYER_PROPERTIES.join("|")
		const levelProps = this.LEVEL_PROPERTIES.join("|")
		const snipeProps = this.SNIPE_PROPERTIES.join("|")

		const playerPattern = `{Player_(A|B)_(${basePlayerProps}|${averageTop1CountRateMatch})}`
		const levelPattern = `{Level_(${levelProps})}`
		const snipePattern = `{Snipe_(${snipeProps})}`

		return [new RegExp(playerPattern, "gi"), new RegExp(levelPattern, "gi"), new RegExp(snipePattern, "gi")]
	}
}

export class UserFeedRegexes {
	private static readonly PLAYER_PROPERTIES = [
		"name", "scoresaber_name", "scoresaber_id", "scoresaber_link", "discordName", "country_name", "country_code", "country_flag", "currentRank", "lastRank",
		"timeSet", "timeSince", "timeSetText", "timeSinceText", "globalRank", "countryRank", "variable", "lastVariable"
	]

	private static readonly BASIC_REGEXES = [
		"SnipedUsers", "UpdateBlock", "SnipedUsersExceptFirst"
	]

	public static getAllBasic() {
		return this.BASIC_REGEXES
	}

	public static getAllComplex() {
		const props = this.PLAYER_PROPERTIES.join("|")
		const pattern = `{(Sniped|Player)_(${props})}`
		return [new RegExp(pattern, "gi")]
	}
}

export class GetPlayerRegexes {
	private static readonly COMPLEX_REGEXES = ["{averageRankedAccuracy_(round|\\d)}", `{${averageTop1CountRateMatch}}`]

	private static readonly BASIC_REGEXES = [
		"scoresaber_id", "scoresaber_name", "scoresaber_link", "discordName", "country_name", "country_code", "country_flag", "pp",
		"rank", "countryRank", "role", "banned", "inactive", "totalScore", "totalRankedScore", "totalPlayCount", "rankedPlayCount",
		"replaysWatched", "topPlayPP", "serverTop1Count", "serverTop1RankedCount", "countryTop1Count", "countryTop1RankedCount",
		"weekDifference", "mainCountriesRank"
	]

	public static getAllBasic() {
		return this.BASIC_REGEXES
	}

	public static getAllComplex() {
		return this.COMPLEX_REGEXES.map(pattern => new RegExp(pattern, "gi"))
	}
}
