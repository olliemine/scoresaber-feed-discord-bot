import { ReadOnlyGet } from "../misc/util.js";
import { LevelDifficulties } from "../types/external.js";
import { HMDs, ScoreSaberPlayersScoreData, ScoreSaberWebSocketData } from "../types/scoresaber.js";

export class ScoreSaberPlay {
	public readonly type: "V2_SCORE" | "WEBSOCKET_SCORE"

	@ReadOnlyGet private _playerID: string
	declare readonly playerID: string

	@ReadOnlyGet private _unmodifiedScore: number
	declare readonly unmodifiedScore: number

	@ReadOnlyGet private _modifiedScore: number;
    declare readonly modifiedScore: number;

    @ReadOnlyGet private _isFC: boolean;
    declare readonly isFC: boolean;

    @ReadOnlyGet private _misses: number;
    declare readonly misses: number;

    @ReadOnlyGet private _pp: number;
    declare readonly pp: number;

	@ReadOnlyGet private _weight: number;
	declare readonly weight: number

    @ReadOnlyGet private _timeSet: Date;
    declare readonly timeSet: Date;

    @ReadOnlyGet private _levelID: number;
    declare readonly levelID: number;

    @ReadOnlyGet private _hash: string;
    declare readonly hash: string;

    @ReadOnlyGet private _isRanked: boolean;
    declare readonly isRanked: boolean;

    @ReadOnlyGet private _stars: number;
    declare readonly stars: number;

    @ReadOnlyGet private _maxScore: number;
    declare readonly maxScore: number;

    @ReadOnlyGet private _difficulty: LevelDifficulties.Number;
    declare readonly difficulty: LevelDifficulties.Number;

    @ReadOnlyGet private _modeName: string;
    declare readonly modeName: string;

    @ReadOnlyGet private _positiveModifiers: boolean;
    declare readonly positiveModifiers: boolean;

	@ReadOnlyGet private _modifiers: string[];
	declare readonly modifiers: string[];
	
	@ReadOnlyGet private _hmdDevice: string
	declare readonly hmdDevice: string

	@ReadOnlyGet private _songName: string
	declare readonly songName: string

	@ReadOnlyGet private _songSubName: string
	declare readonly songSubName: string

	@ReadOnlyGet private _songAuthorName: string
	declare readonly songAuthorName: string

	@ReadOnlyGet private _levelAuthorName: string
	declare readonly levelAuthorName: string

	@ReadOnlyGet private _levelCreatedAt: Date
	declare readonly levelCreatedAt: Date

	@ReadOnlyGet private _coverImage: string
	declare readonly coverImage: string

	/** BeatSaver map key (`level.code`). Present on most V2 scores; absent on websocket scores. */
	@ReadOnlyGet private _bsid?: string
	declare readonly bsid?: string

	/** Present on most V2 scores; absent on websocket scores. NPS still requires BeatSaver. */
	@ReadOnlyGet private _bpm?: number
	declare readonly bpm?: number

	constructor(play: ScoreSaberPlayersScoreData, type: "V2_SCORE")
	constructor(play: ScoreSaberWebSocketData["commandData"], type: "WEBSOCKET_SCORE")
	constructor(play: ScoreSaberPlayersScoreData | ScoreSaberWebSocketData["commandData"], type: "V2_SCORE" | "WEBSOCKET_SCORE") {
		this.type = type

		if(type === "V2_SCORE") {
			const v2Play = play as ScoreSaberPlayersScoreData

			const legacyHmd = v2Play.score.legacyHmdId != null ? HMDs[v2Play.score.legacyHmdId] : undefined

			this._playerID = v2Play.score.player.id
			this._unmodifiedScore = v2Play.score.unmodifiedScore
			this._modifiedScore = v2Play.score.modifiedScore
			this._isFC = v2Play.score.fullCombo
			this._misses = v2Play.score.badCuts + v2Play.score.missedNotes
			this._pp = v2Play.score.pp
			this._weight = v2Play.score.weight
			this._timeSet = new Date(v2Play.score.createdAt)
			this._levelID = v2Play.leaderboard.id
			this._hash = v2Play.leaderboard.map.hash
			this._isRanked = v2Play.leaderboard.realm.leaderboardStatus === "RANKED"
			this._stars = v2Play.leaderboard.realm.stars
			this._maxScore = v2Play.leaderboard.maxScore
			this._difficulty = v2Play.leaderboard.difficulty.difficulty
			this._modeName = v2Play.leaderboard.difficulty.gameMode
			this._positiveModifiers = v2Play.leaderboard.realm.positiveModifiers
			this._modifiers = v2Play.score.mods
			this._hmdDevice = v2Play.score.device?.hmd ?? legacyHmd ?? HMDs[0]
			this._songName = v2Play.leaderboard.map.songName
			this._songSubName = v2Play.leaderboard.map.songSubName
			this._songAuthorName = v2Play.leaderboard.map.songAuthorName
			this._levelAuthorName = v2Play.leaderboard.map.levelAuthorName
			this._levelCreatedAt = new Date(v2Play.leaderboard.createdAt)
			this._coverImage = v2Play.leaderboard.map.coverUrl
			this._bsid = v2Play.leaderboard.map.bsid ?? undefined
			this._bpm = v2Play.leaderboard.map.bpm
		} else {
			const wsPlay = play as ScoreSaberWebSocketData["commandData"]

			this._playerID = wsPlay.score.leaderboardPlayerInfo.id
			this._unmodifiedScore = wsPlay.score.baseScore
			this._modifiedScore = wsPlay.score.modifiedScore
			this._isFC = wsPlay.score.fullCombo
			this._misses = wsPlay.score.badCuts + wsPlay.score.missedNotes
			this._pp = wsPlay.score.pp
			this._weight = wsPlay.score.weight
			this._timeSet = new Date(wsPlay.score.timeSet)
			this._levelID = wsPlay.leaderboard.id
			this._hash = wsPlay.leaderboard.songHash
			this._isRanked = wsPlay.leaderboard.ranked
			this._stars = wsPlay.leaderboard.stars
			this._maxScore = wsPlay.leaderboard.maxScore
			this._difficulty = wsPlay.leaderboard.difficulty.difficulty
			this._modeName = wsPlay.leaderboard.difficulty.gameMode
			this._positiveModifiers = wsPlay.leaderboard.positiveModifiers
			this._modifiers = wsPlay.score.modifiers ? wsPlay.score.modifiers.split(",") : []
			this._hmdDevice = wsPlay.score.deviceHmd ?? HMDs[wsPlay.score.hmd] ?? HMDs[0]
			this._songName = wsPlay.leaderboard.songName
			this._songSubName = wsPlay.leaderboard.songSubName
			this._songAuthorName = wsPlay.leaderboard.songAuthorName
			this._levelAuthorName = wsPlay.leaderboard.levelAuthorName
			this._levelCreatedAt = new Date(wsPlay.leaderboard.createdDate)
			this._coverImage = wsPlay.leaderboard.coverImage
		}
	}
}