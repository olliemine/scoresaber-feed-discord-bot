import fs from "fs"
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { BirthdayData } from "../types/birthdays.js";
import { RankedleLeaderboardEntry } from "../types/rankedle.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataPath = (name: string) => path.join(__dirname, "../../data", name)

type Contents = {
	visitors: { ids: string[] }
	birthdays: BirthdayData
	rankedleLeaderboard: RankedleLeaderboardEntry[]
}

type Path = keyof Contents
type Content<T extends Path> = Contents[T]

const DEFAULTS: { [K in Path]: () => Contents[K] } = {
	visitors: () => ({ ids: [] }),
	birthdays: () => ({ birthdays: [] }),
	rankedleLeaderboard: () => []
}

class PathResolve {
	path: Path
	localPath: string
	legacyPath?: string

	constructor(path: Path) {
		this.path = path
		this.localPath = this.getPath()
		this.legacyPath = this.getLegacyPath()
	}

	private getPath(): string {
		switch(this.path) {
			case "visitors":
				return dataPath("visitors.json")
			case "birthdays":
				return dataPath("birthdays.json")
			case "rankedleLeaderboard":
				return dataPath("rankedleLeaderboard.json")
		}
	}

	private getLegacyPath(): string | undefined {
		if(this.path === "rankedleLeaderboard") return path.join(__dirname, "../../rankedle/leaderboard.txt")
		return undefined
	}
}

async function readIfExists(localPath: string): Promise<string | null> {
	try {
		return await fs.promises.readFile(localPath, "utf-8")
	} catch(err) {
		if((err as NodeJS.ErrnoException).code === "ENOENT") return null
		throw err
	}
}

export async function getJSON<T extends Path>(path: T): Promise<Content<T>> {
	const { localPath, legacyPath } = new PathResolve(path)

	const data = await readIfExists(localPath) ?? (legacyPath ? await readIfExists(legacyPath) : null)

	if(data == null) return DEFAULTS[path]() as Content<T>

	return JSON.parse(data)
}

export async function writeJSON<T extends Path>(path: T, data: Content<T>): Promise<void> {
	const { localPath } = new PathResolve(path)
	const temporaryPath = `${localPath}.tmp`

	await fs.promises.mkdir(dirname(localPath), { recursive: true })
	await fs.promises.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf-8")
	await fs.promises.rename(temporaryPath, localPath)
}
