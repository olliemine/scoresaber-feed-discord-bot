//generated using https://transform.tools/json-schema-to-typescript

type Feeds = string
export type RegexEmbed = {
	type: "embed"
	embedTitle?: string
	embedDescription?: string
	embedFields?: {
		[k: string]: [string, string, boolean, string]
	}
	embedColor?: {
		value: string
		type: string
	}
	embedThumbnail?: string
	embedImage?: string
	buttons?:
	| [string]
	| [string, string]
	| [string, string, string]
	| [string, string, string, string]
	| [string, string, string, string, string]
	embedURL?: string
}
export type RegexMessage =
{
	type: "message",
	message: string
	buttons?:
	| [string]
	| [string, string]
	| [string, string, string]
	| [string, string, string, string]
	| [string, string, string, string, string]
}
	| RegexEmbed
export interface DefaultChannelFeedConfiguration {
	Channel: string
	Feeds: "all" | [Feeds, ...Feeds[]]
}
export interface MapChannelFeedConfiguration extends DefaultChannelFeedConfiguration {
	Types?: "both" | "unranked" | "ranked"
}
interface Log {
	"on-console": boolean
	"discord-channel-id": string
}
export interface RankedleConfiguration {
	channelId?: string
	countdownSeconds: number
	audioClipDuration: number
	extendedAudioClipDuration: number
	maxPointsPerGame: number
	waitBetweenRounds: number
	roundTimeLimit: number
	downloadTimeoutMS: number
	minStars?: number
	maxStars?: number
	embedColor: string
}
export interface BirthdaysConfiguration {
	channelId?: string
	announceHourUTC: number
}

export default interface config {
	prefixes: string[]
	"server-id": string,
	botAuthor: string,
	"masters-user-ids": string[]
	"main-countries": string[]
	"bot-channels": string[],
	"admin-roles": string[]
	language: string
	activity?: {
		name: string
		type: 0 | 1 | 2 | 3 | 5
	}
	database: {
		"user-login": {
			"do-discord-nicknames": boolean
			"discord-nicknames": {
				MainCountryUser?: string
				NonMainCountryUser?: string
				InactiveUser?: string
				BannedUser?: string
				Visitor?: string
			}
			"give-roles": {
				MainCountryUser: string[]
				NonMainCountryUser: string[]
				InactiveUser: string[]
				BannedUser: string[]
				Visitor: string[]
			}
			"default-values": {
				doSnipePing: boolean
			}
			"disable-warnings": boolean
			IsVisitorWithoutDeclaring: boolean
			VerificationChannel: {
				enabled: boolean
				id?: string
				deleteMessages: boolean
				haveInstructionMessage: boolean
			}
		}
		players: {
			Unknowns: {
				SaveUnknowns: boolean
			}
			update: {
				"enable-updates-for-NonMainCountryUsers": boolean
				ppLimit: number
			}
			roles: {
				GiveRankRolestoInactiveUsers: boolean
				list: {
					from: number
					to: number
					country: string[]
					ids: [string, ...string[]]
					global: boolean
				}[]
			},
			feed: {
				doPingsPlayer: boolean
				doPingsSniped: boolean
				feeds?: [DefaultChannelFeedConfiguration, ...DefaultChannelFeedConfiguration[]]
				feedMessages?: {
					[k: string]: RegexMessage
				}
			}
		},
		maps: {
			Unknowns: {
				findUntilNotUnknown: boolean
				searched: boolean
				canHaveTopPlay: boolean
				canBeSniped: boolean
				canSnipe: boolean
				canSnipeUnknowns: boolean
				canHaveBetterScore: boolean
				canDoNewPlay: boolean
				canDoNewMap: boolean
			}
			feed: {
				doPingsPlayerA: boolean
				doPingsPlayerB: boolean
				betterPlayPercentage: number
				top1IfNoUsers: boolean
				feeds?: [
					MapChannelFeedConfiguration,
					...MapChannelFeedConfiguration[]
				]
				feedMessages?: {
					[k: string]: RegexMessage
				}
			}
		}
		suspendedUsersForLeaderboards: boolean
		suspendedUsersForMapLeaderboards: boolean
	}
	messages: {
		"enable-dm": boolean
		"only-work-on-server": boolean
	}
	commands: {
		disableCommandsForBaseUsers: boolean
		getplayer?: RegexMessage
		rankedle: RankedleConfiguration
		birthdays: BirthdaysConfiguration
		disabling?: string[]
	}
	logger: {
		enableTimestamp: boolean
		logs: {
			info: Log
			warn: Log
			error: Log
			debug: Log
			fatal: Log
			configuration: Log
		}
	}
	debug: number,
	loadingEmoji?: string,
	scoresaberEmoji?: string,
	beatsaverEmoji?: string,
	testMode: boolean
}