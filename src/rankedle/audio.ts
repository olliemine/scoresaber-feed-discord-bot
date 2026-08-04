import AdmZip from "adm-zip"
import { execFile } from "child_process"
import fs from "fs"
import path, { dirname } from "path"
import sharp from "sharp"
import { fileURLToPath } from "url"
import { promisify } from "util"
import getConfig from "../config/getConfig.js"
import { logger } from "../logger.js"
import { responseErrorString } from "../misc/util.js"
import { RankedleSong } from "../types/rankedle.js"

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const songsPath = path.join(__dirname, "../../data/rankedle")

const songDirectory = (hash: string) => path.join(songsPath, hash)
const sourcePath = (hash: string) => path.join(songDirectory(hash), "source.ogg")
const clipPath = (hash: string, extended: boolean) => path.join(songDirectory(hash), extended ? "clip-extended.ogg" : "clip.ogg")
const coverPath = (hash: string, blurred: boolean) => path.join(songDirectory(hash), blurred ? "cover-blurred.jpg" : "cover.jpg")

async function exists(target: string): Promise<boolean> {
	try {
		await fs.promises.access(target)
		return true
	} catch {
		return false
	}
}

async function ffmpeg(args: string[]) {
	await execFileAsync("ffmpeg", args)
}

export async function isFfmpegAvailable(): Promise<boolean> {
	try {
		await ffmpeg(["-version"])
		return true
	} catch {
		return false
	}
}

async function downloadZip(url: string, destination: string, timeoutMS: number) {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMS)

	try {
		const response = await fetch(url, { signal: controller.signal })

		if(!response.ok) throw new Error(responseErrorString(response))

		await fs.promises.writeFile(destination, new Uint8Array(await response.arrayBuffer()))
	} finally {
		clearTimeout(timer)
	}
}

async function ensureSource(song: RankedleSong): Promise<string> {
	const source = sourcePath(song.hash)

	if(await exists(source)) return source

	const directory = songDirectory(song.hash)
	const extracted = path.join(directory, "extracted")
	const archive = path.join(directory, "map.zip")

	await fs.promises.mkdir(directory, { recursive: true })

	try {
		await downloadZip(song.downloadUrl, archive, getConfig().commands.rankedle.downloadTimeoutMS)

		new AdmZip(archive).extractAllTo(extracted, true)

		const audioFile = (await fs.promises.readdir(extracted)).find(file => file.endsWith(".egg") || file.endsWith(".ogg"))

		if(!audioFile) throw new Error(`No audio track was found in the archive of ${song.hash}`)

		await ffmpeg(["-i", path.join(extracted, audioFile), "-c:a", "libvorbis", source, "-y"])
	} finally {
		await fs.promises.rm(archive, { force: true })
		await fs.promises.rm(extracted, { recursive: true, force: true })
	}

	return source
}

export async function prepareClip(song: RankedleSong): Promise<{ clipPath: string, clipStart: number }> {
	const { audioClipDuration, extendedAudioClipDuration } = getConfig().commands.rankedle

	const source = await ensureSource(song)
	const latestStart = Math.max(0, song.duration - extendedAudioClipDuration - 1)
	const clipStart = Math.floor(Math.random() * latestStart)
	const output = clipPath(song.hash, false)

	await ffmpeg(["-i", source, "-ss", String(clipStart), "-t", String(audioClipDuration), "-c:a", "libvorbis", output, "-y"])

	return { clipPath: output, clipStart }
}

export async function prepareExtendedClip(song: RankedleSong, clipStart: number): Promise<string> {
	const output = clipPath(song.hash, true)

	if(await exists(output)) return output

	const source = await ensureSource(song)

	await ffmpeg([
		"-i", source,
		"-ss", String(clipStart),
		"-t", String(getConfig().commands.rankedle.extendedAudioClipDuration),
		"-c:a", "libvorbis",
		output, "-y"
	])

	return output
}

export async function prepareBlurredCover(song: RankedleSong): Promise<string> {
	const blurred = coverPath(song.hash, true)

	if(await exists(blurred)) return blurred

	const original = coverPath(song.hash, false)

	await fs.promises.mkdir(songDirectory(song.hash), { recursive: true })

	if(!await exists(original)) {
		const response = await fetch(song.coverUrl)

		if(!response.ok) throw new Error(responseErrorString(response))

		await fs.promises.writeFile(original, new Uint8Array(await response.arrayBuffer()))
	}

	await sharp(original).blur(8).jpeg({ quality: 85 }).toFile(blurred)

	return blurred
}

export async function removeSongs(hashes: string[]) {
	for(const hash of hashes) {
		await fs.promises.rm(songDirectory(hash), { recursive: true, force: true })
			.catch(err => logger.unknownError(err))
	}
}

export async function clearCache() {
	await fs.promises.rm(songsPath, { recursive: true, force: true })
		.catch(err => logger.unknownError(err))
}
