export type MapsRequest = {
	[key: string]: Root
} | Root

export interface Root {
	id: string
	name: string
	description: string
	uploader: Uploader
	metadata: Metadata
	stats: Stats
	uploaded: string
	automapper: boolean
	ranked: boolean
	qualified: boolean
	versions: Version[]
	curator: Curator
	curatedAt: string
	createdAt: string
	updatedAt: string
	lastPublishedAt: string
	tags: string[]
}

export interface Uploader {
	id: number
	name: string
	hash: string
	avatar: string
	type: string
	admin: boolean
	curator: boolean
	verifiedMapper: boolean
	playlistUrl: string
}

export interface Metadata {
	bpm: number
	duration: number
	songName: string
	songSubName: string
	songAuthorName: string
	levelAuthorName: string
}

export interface Stats {
	plays: number
	downloads: number
	upvotes: number
	downvotes: number
	score: number
	reviews: number
}

export interface Version {
	hash: string
	state: string
	createdAt: string
	sageScore: number
	diffs: Diff[]
	downloadURL: string
	coverURL: string
	previewURL: string
}

export interface Diff {
	njs: number
	offset: number
	notes: number
	bombs: number
	obstacles: number
	nps: number
	length: number
	characteristic: string
	difficulty: string
	events: number
	chroma: boolean
	me: boolean
	ne: boolean
	cinema: boolean
	seconds: number
	paritySummary: ParitySummary
	stars: number
	maxScore: number
	label: string
}

export interface ParitySummary {
	errors: number
	warns: number
	resets: number
}

export interface Curator {
	id: number
	name: string
	hash: string
	avatar: string
	type: string
	admin: boolean
	curator: boolean
	verifiedMapper: boolean
	playlistUrl: string
}

export type BeatSaverWebSocketMessageType = "MAP_UPDATE" | "MAP_DELETE"

export interface BeatSaverMapDeletePayload {
	mapId: string
}

export interface BeatSaverMapDeleteMessage {
	type: "MAP_DELETE"
	msg: BeatSaverMapDeletePayload
}

export interface BeatSaverMapUpdateMessage {
	type: "MAP_UPDATE"
	msg: Root
}

export type BeatSaverWebSocketMessage = BeatSaverMapDeleteMessage | BeatSaverMapUpdateMessage

export function parseBeatSaverWebSocketMessage(data: unknown): BeatSaverWebSocketMessage | null {
	if(typeof data !== "object" || data == null) return null

	const obj = data as Record<string, unknown>

	if(typeof obj.type !== "string" || typeof obj.msg !== "object" || obj.msg == null) return null

	if(obj.type === "MAP_DELETE") {
		const msg = obj.msg as Record<string, unknown>
		if(typeof msg.mapId !== "string") return null
		return { type: "MAP_DELETE", msg: { mapId: msg.mapId } }
	}

	if(obj.type === "MAP_UPDATE") {
		const msg = obj.msg as Record<string, unknown>
		if(typeof msg.id !== "string" || !Array.isArray(msg.versions)) return null
		return { type: "MAP_UPDATE", msg: obj.msg as Root }
	}

	return null
}
