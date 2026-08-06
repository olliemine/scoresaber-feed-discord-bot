import { level, levelPlayer, user } from "../types/db.js"
import config, { MapChannelFeedConfiguration } from "../types/config.js"
import { FeedsEnabled } from "../regex/feedEventHandler.js"
import getConfig from "../config/getConfig.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { LEVEL_FEEDS, LEVEL_FEEDS_ENABLED, getLevelEventFromCombination } from "./levelFeedConfiguration.js"
import { getUserCountry, isFromMainCountry } from "../discord/account/userFunctions.js"
import { getRank, matchUsersByCountry } from "../db/filteredUsers.js"
import { postLevelFeed } from "./levelFeedMessage.js"
import { PromiseOrNot } from "../types/util.js"
import { ScoreSaberPlay } from "../classes/scoreSaberPlay.js"
import { includesEvent, resolveFeedChannel } from "./feedCommon.js"
import { getTopPlays, isPlayInTopScores } from "../scoresaber/player/playerFunctions.js"

function getSnipedPlayer(leaderboard: levelPlayer[], oldLeaderboard: levelPlayer[], userLeaderboardIndex: number, userOldLeaderboardIndex: number) {
	if(!leaderboard[userLeaderboardIndex + 1]) return null
	
	const newBelowPlayers = leaderboard.filter((a, i) => i > userLeaderboardIndex)

	if(userOldLeaderboardIndex === -1) {
		for (let belowPlayer of newBelowPlayers) {
			if(belowPlayer.category !== "Unknown") return belowPlayer
			if(getConfig().database.maps.Unknowns.canBeSniped) return belowPlayer
			if(!getConfig().database.maps.Unknowns.findUntilNotUnknown) break
		}
		
		return null
	}

	const oldAbovePlayersIDs = oldLeaderboard.filter((a, i) => i < userOldLeaderboardIndex).map(a => a.playerID)

	for (let belowPlayer of newBelowPlayers) {
		//If the player wasnt above before, then we continue going down the list
		if(!oldAbovePlayersIDs.includes(belowPlayer.playerID)) continue
		//If the player is not a Unknown no further checks are needed
		if(belowPlayer.category !== "Unknown") return belowPlayer
		//If the player is an Unknown and they have the correct permission then the player is returned
		if(getConfig().database.maps.Unknowns.canBeSniped) return belowPlayer
		//If it should not find until a non unknown comes through then we exit out of the loop and return null
		if(!getConfig().database.maps.Unknowns.findUntilNotUnknown) break
	}
	
	//No checks coincided
	return null
}

const betterScorePercentage = getConfig().database.maps.feed.betterPlayPercentage == null ? 2 : getConfig().database.maps.feed.betterPlayPercentage

function unknownCheck(user: user, check: keyof config["database"]["maps"]["Unknowns"]) {
	return user.category !== "Unknown" || getConfig().database.maps.Unknowns[check]
}

function checkTypesFeed(channelConfiguration: MapChannelFeedConfiguration, score: ScoreSaberPlay) {
	if(!channelConfiguration.Types || channelConfiguration.Types.toLowerCase() === "both") return true
	const type = channelConfiguration.Types.toLowerCase()
	if(type === "ranked") return score.isRanked	
	if(type === "unranked") return !score.isRanked
}

/** minPP inclusive (>=), maxPP exclusive (<). */
function passesPPGates(channelConfiguration: MapChannelFeedConfiguration, score: ScoreSaberPlay) {
	if(channelConfiguration.minPP != null && score.pp < channelConfiguration.minPP) return false
	if(channelConfiguration.maxPP != null && score.pp >= channelConfiguration.maxPP) return false
	return true
}

function unknownCanSnipeUnknownsCheck(playerA: levelPlayer, playerB: levelPlayer) {
	if(!playerB) return true

	return playerA.category !== "Unknown" || 
	playerB.category !== "Unknown" || 
	getConfig().database.maps.Unknowns.canSnipeUnknowns
}

async function forEachFeedChannel(
	options: { score?: ScoreSaberPlay, skipUnrankedOnly?: boolean },
	handler: (channelConfiguration: MapChannelFeedConfiguration) => Promise<void>
) {
	if(!LEVEL_FEEDS) return

	for await(const channelConfiguration of LEVEL_FEEDS) {
		if(options.skipUnrankedOnly) {
			if(channelConfiguration.Types && channelConfiguration.Types.toLowerCase() === "unranked") continue
		} else if(options.score && !checkTypesFeed(channelConfiguration, options.score)) {
			continue
		}

		if(options.score && !passesPPGates(channelConfiguration, options.score)) continue

		const channel = resolveFeedChannel(channelConfiguration.Channel)
		if(!channel) continue

		await handler(channelConfiguration)
	}
}

class LevelFeedLeaderboard {
	public name: string
	public leaderboard: levelPlayer[]
	public oldLeaderboard: levelPlayer[]
	public playerIndex: number
	public playerOldIndex: number
	public shouldCheck: boolean
	public checks: {[key in keyof typeof LEVEL_FEEDS_ENABLED["events"]]: boolean}
	public postFeedObject: {[key in keyof typeof LEVEL_FEEDS_ENABLED["events"]]: [levelPlayer, levelPlayer | undefined, levelPlayer | undefined, levelPlayer | undefined]}
	public snipedPlayer: levelPlayer | null

	public getOldUserIndex(index: number) {
		if(index === -1) return undefined
		return this.oldLeaderboard[index]
	}

	public getOldUserId(id?: string) {
		return this.getOldUserIndex(this.oldLeaderboard.findIndex(player => player.playerID === id))
	}

	constructor(name: string, leaderboard: levelPlayer[], oldLeaderboard: levelPlayer[], dataUser: user, shouldCheck: boolean) {
		this.name = name
		this.leaderboard = leaderboard
		this.oldLeaderboard = oldLeaderboard
		this.shouldCheck = shouldCheck
		this.playerIndex = this.leaderboard.findIndex(plays => plays.playerID === dataUser["scoresaberID"])
		this.playerOldIndex = this.oldLeaderboard.findIndex(plays => plays.playerID === dataUser["scoresaberID"])
		this.snipedPlayer = getSnipedPlayer(this.leaderboard, this.oldLeaderboard,
			this.playerIndex, this.playerOldIndex)

		this.checks = {
			Top1: this.leaderboard[0].playerID === dataUser["scoresaberID"] && 	//Is the user top 1? 
				this.oldLeaderboard[0] &&											//Was the old leaderboard not empty?
				this.oldLeaderboard[0].playerID !== dataUser["scoresaberID"] &&     //Was the user not top 1?
				(getConfig().database.maps.feed.top1IfNoUsers || this.leaderboard[1]) && 	//If top 1 should be with other users then check if leaderboard is not empty
				unknownCanSnipeUnknownsCheck(this.leaderboard[0], this.leaderboard[1]),
			BetterTopPlay: !!this.oldLeaderboard[0] &&
				this.leaderboard[0].playerID === dataUser["scoresaberID"] && //Is the user top 1?
				this.oldLeaderboard[0].playerID === dataUser["scoresaberID"] && //Was the user top 1?
				(getConfig().database.maps.feed.top1IfNoUsers || !!this.leaderboard[1]),
			Snipe: !!this.snipedPlayer &&
				unknownCanSnipeUnknownsCheck(this.leaderboard[this.playerIndex], this.snipedPlayer),
			BetterPlay: true,
			NewMap: true,
			NewPlay: true,
			TopPlay: true
		}

		this.postFeedObject = {
			Top1: [this.leaderboard[0], this.leaderboard[1], this.playerOld, this.getOldUserId(this.leaderboard[1]?.playerID)],
			BetterTopPlay: [this.leaderboard[0], undefined, this.oldLeaderboard[0], undefined],
			Snipe: [this.player, this.snipedPlayer ?? undefined, this.playerOld, this.getOldUserId(this.snipedPlayer?.playerID ?? "")],
			BetterPlay: [this.player, undefined, this.playerOld, undefined],
			NewMap: [this.player, undefined, undefined, undefined],
			NewPlay: [this.player, undefined, undefined, undefined],
			TopPlay: [this.player, undefined, undefined, undefined]
		}
	}

	public get player() {
		return this.leaderboard[this.playerIndex]
	}

	public get playerOld() {
		if(this.playerOldIndex === -1) return undefined
		return this.oldLeaderboard[this.playerOldIndex]
	}
}

export class LevelFeedUpdater {
	static async runPlay(dataUser: user, level: level, oldLeaderboard: levelPlayer[], score: ScoreSaberPlay) {
		if(!LEVEL_FEEDS) return
		if(!dataUser["scoresaberLastMap"]) return
		
		const isDataUserMainCountry = isFromMainCountry(getUserCountry(dataUser))

		const userLeaderboardIndex = level.leaderboard.findIndex(plays => plays.playerID === dataUser["scoresaberID"])
		const userOldLeaderboardIndex = oldLeaderboard.findIndex(plays => plays.playerID === dataUser["scoresaberID"])
		
		const mainCountriesLeaderboard = level.leaderboard.filter(plays => isFromMainCountry(plays.country))
		const oldMainCountriesLeaderboard = oldLeaderboard.filter(plays => isFromMainCountry(plays.country))

		const leaderboards: LevelFeedLeaderboard[] = [
			new LevelFeedLeaderboard("All", level.leaderboard, oldLeaderboard, dataUser, true), 
			new LevelFeedLeaderboard("MainCountries", mainCountriesLeaderboard, oldMainCountriesLeaderboard, dataUser, isDataUserMainCountry)
		]

		await forEachFeedChannel({ score }, async (channelConfiguration) => {
			let combination = ""

			async function handlePostFeed(playerA: levelPlayer, playerB?: levelPlayer, oldPlayerA?: levelPlayer, oldPlayerB?: levelPlayer) {
				await postLevelFeed(channelConfiguration, combination, score, level, playerA, playerB, oldPlayerA, oldPlayerB)
			}
			
			async function feedEventHandler(
				unknownCheckString: keyof config["database"]["maps"]["Unknowns"],
				reverse: boolean,
				event: FeedsEnabled["events"][""],
				mapCheck?: () => PromiseOrNot<boolean>
			): Promise<boolean> {
				if(!unknownCheck(dataUser, unknownCheckString)) return false

				const mapCheckRes = mapCheck ? await mapCheck() : true

				if(!mapCheckRes) return false

				const checkLeaderboards = (reverse ? leaderboards.slice().reverse() : leaderboards)
				
				for (let leaderboard of checkLeaderboards) {
					if(leaderboard.shouldCheck === false) continue
					combination = `${event.name}${leaderboard.name}`

					if(!includesEvent(combination, channelConfiguration, getLevelEventFromCombination)) continue

					const eventName = event.name as keyof typeof LEVEL_FEEDS_ENABLED["events"]

					if(!leaderboard.checks[eventName]) continue

					logger.debug(`${event.name} event`, DEBUG_LEVELS.VARIABLE_DEBUG)
					await handlePostFeed(...leaderboard.postFeedObject[eventName])
					return true
				}

				return false
			}

			if(await feedEventHandler("canSnipe", false, LEVEL_FEEDS_ENABLED.events.Top1)) return
		
			if(await feedEventHandler("canHaveBetterScore", false, LEVEL_FEEDS_ENABLED.events.BetterTopPlay)) return
		
			if(await feedEventHandler("canSnipe", false, LEVEL_FEEDS_ENABLED.events.Snipe)) return

			if(await feedEventHandler("canHaveBetterScore", true, LEVEL_FEEDS_ENABLED.events.BetterPlay, () => {
				if(!level.maxScore || userOldLeaderboardIndex === -1) return false
				
				const scoreDifference = (((level.leaderboard[userLeaderboardIndex].score.modifiedScore -
					oldLeaderboard[userOldLeaderboardIndex].score.modifiedScore) / level.maxScore)*100).toFixed(2)

				return parseFloat(scoreDifference) > betterScorePercentage
			})) return
			
			//NewMap MainCountries
			combination = `${LEVEL_FEEDS_ENABLED.events.NewMap.name}MainCountries`

			if(isDataUserMainCountry &&
				unknownCheck(dataUser, "canDoNewMap") &&
				!!mainCountriesLeaderboard[0] &&
				!oldMainCountriesLeaderboard[0] &&
				includesEvent(combination, channelConfiguration, getLevelEventFromCombination)
			) {
				logger.debug("NewMap MainCountries Event", DEBUG_LEVELS.VARIABLE_DEBUG)
				await handlePostFeed(level.leaderboard[userLeaderboardIndex])
				return
			}
			
			await feedEventHandler("canDoNewPlay", true, LEVEL_FEEDS_ENABLED.events.NewPlay, () => {
				return userOldLeaderboardIndex === -1
			})
		})
	}

	static async runNewMap(dataUser: user, map: level, score: ScoreSaberPlay) {
		if(!LEVEL_FEEDS) return
		if(!dataUser["scoresaberLastMap"] || !isFromMainCountry(getUserCountry(dataUser))) return
		if(!unknownCheck(dataUser, "canDoNewMap")) return

		const leaderboards = ["MainCountries", "All"]

		await forEachFeedChannel({ score }, async (channelConfiguration) => {
			for(const leaderboard of leaderboards) {
				const combination = `${LEVEL_FEEDS_ENABLED.events.NewMap.name}${leaderboard}`
				if(includesEvent(combination, channelConfiguration, getLevelEventFromCombination)) {
					logger.debug("NewMap Event", DEBUG_LEVELS.VARIABLE_DEBUG)
					await postLevelFeed(channelConfiguration, combination, score, map, map.leaderboard[0])
					break
				}
			}
		})
	}

	/**
	 * @returns true if at least one TopPlay message was posted for this score.
	 * When true, map feeds (Top1 / Snipe / …) should be skipped for the same play.
	 */
	static async runTopPlay(
		dataUser: user,
		map: level,
		score: ScoreSaberPlay,
		options: {
			isNewPersonalBest: boolean
			/** Shared across a play batch. `plays` undefined = not fetched, null = fetch failed. */
			topScoresCache?: { plays?: ScoreSaberPlay[] | null, limit: number }
		} = { isNewPersonalBest: false }
	): Promise<boolean> {
		if(!LEVEL_FEEDS) return false
		if(!dataUser["scoresaberLastMap"]?.id || !isFromMainCountry(getUserCountry(dataUser))) return false
		if(dataUser.category === "Unknown" && !getConfig().database.maps.Unknowns.canHaveTopPlay) return false

		const { isNewPersonalBest } = options
		const needsPersonalBestRank = isNewPersonalBest && LEVEL_FEEDS.some(channelConfiguration => {
			if(!passesPPGates(channelConfiguration, score)) return false
			if(!checkTypesFeed(channelConfiguration, score)) return false
			return includesEvent(`${LEVEL_FEEDS_ENABLED.events.TopPlay.name}All`, channelConfiguration, getLevelEventFromCombination)
				|| includesEvent(`${LEVEL_FEEDS_ENABLED.events.TopPlay.name}Country`, channelConfiguration, getLevelEventFromCombination)
		})

		const allBestRank = needsPersonalBestRank
			? await getRank(dataUser, "scoresaberTopPlay.pp", true, "descending")
			: null
		const countryBestRank = needsPersonalBestRank
			? await getRank(dataUser, "scoresaberTopPlay.pp", true, "descending", matchUsersByCountry(getUserCountry(dataUser)))
			: null

		const topScoresCache = options.topScoresCache ?? { limit: 0 }

		async function ensureTopScores(limit: number) {
			if(topScoresCache.plays === null) return null
			if(topScoresCache.plays && topScoresCache.limit >= limit) return topScoresCache.plays

			const fetched = await getTopPlays(dataUser.scoresaberID, limit)
			if(!fetched) {
				topScoresCache.plays = null
				return null
			}

			topScoresCache.plays = fetched
			topScoresCache.limit = limit
			return topScoresCache.plays
		}

		let posted = false

		await forEachFeedChannel({ score }, async (channelConfiguration) => {
			let combination = ""

			async function handlePostFeed() {
				logger.debug("TopPlay Event", DEBUG_LEVELS.VARIABLE_DEBUG)
				await postLevelFeed(channelConfiguration, combination, score, map, map.leaderboard[0])
				posted = true
			}

			if(isNewPersonalBest) {
				combination = `${LEVEL_FEEDS_ENABLED.events.TopPlay.name}All`
				if(includesEvent(combination, channelConfiguration, getLevelEventFromCombination) && allBestRank === 1) {
					await handlePostFeed()
					return
				}

				combination = `${LEVEL_FEEDS_ENABLED.events.TopPlay.name}Country`
				if(includesEvent(combination, channelConfiguration, getLevelEventFromCombination) && countryBestRank === 1) {
					await handlePostFeed()
					return
				}

				combination = `${LEVEL_FEEDS_ENABLED.events.TopPlay.name}Personal`
				if(includesEvent(combination, channelConfiguration, getLevelEventFromCombination)) {
					await handlePostFeed()
					return
				}

				combination = `${LEVEL_FEEDS_ENABLED.events.TopPlay.name}Top1`
				if(includesEvent(combination, channelConfiguration, getLevelEventFromCombination)) {
					await handlePostFeed()
					return
				}
			}

			const topNContexts = Array.from({ length: 20 }, (_, i) => i + 1)
				.filter(n => {
					if(n === 1) return false
					const combo = `${LEVEL_FEEDS_ENABLED.events.TopPlay.name}Top${n}`
					return includesEvent(combo, channelConfiguration, getLevelEventFromCombination)
				})
				.sort((a, b) => a - b)

			if(topNContexts.length) {
				const topScores = await ensureTopScores(topNContexts[topNContexts.length - 1])
				if(topScores) {
					for(const n of topNContexts) {
						combination = `${LEVEL_FEEDS_ENABLED.events.TopPlay.name}Top${n}`
						if(isPlayInTopScores(score, topScores.slice(0, n))) {
							await handlePostFeed()
							return
						}
					}
				}
			}
		})

		return posted
	}
}

/** Stable id for a play within a refresh batch (TopPlay vs map-feed priority). */
export function playFeedKey(play: ScoreSaberPlay) {
	return `${play.levelID}:${play.timeSet.getTime()}`
}
