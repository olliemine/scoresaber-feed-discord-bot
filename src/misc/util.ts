import Vibrant from "node-vibrant"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { ColorResolvable, Colors, HexColorString } from "discord.js"

const LEGACY_COLOR_MAP: Record<string, ColorResolvable> = {
	DEFAULT: Colors.Default,
	WHITE: Colors.White,
	AQUA: Colors.Aqua,
	GREEN: Colors.Green,
	BLUE: Colors.Blue,
	YELLOW: Colors.Yellow,
	PURPLE: Colors.Purple,
	LUMINOUS_VIVID_PINK: Colors.LuminousVividPink,
	FUCHSIA: Colors.Fuchsia,
	GOLD: Colors.Gold,
	ORANGE: Colors.Orange,
	RED: Colors.Red,
	GREY: Colors.Grey,
	DARKER_GREY: Colors.DarkerGrey,
	NAVY: Colors.Navy,
	DARK_AQUA: Colors.DarkAqua,
	DARK_GREEN: Colors.DarkGreen,
	DARK_BLUE: Colors.DarkBlue,
	DARK_PURPLE: Colors.DarkPurple,
	DARK_VIVID_PINK: Colors.DarkVividPink,
	DARK_GOLD: Colors.DarkGold,
	DARK_ORANGE: Colors.DarkOrange,
	DARK_RED: Colors.DarkRed,
	DARK_GREY: Colors.DarkGrey,
	LIGHT_GREY: Colors.LightGrey,
	DARK_NAVY: Colors.DarkNavy,
	BLURPLE: Colors.Blurple,
	GREYPLE: Colors.Greyple,
	DARK_BUT_NOT_BLACK: Colors.DarkButNotBlack,
	NOT_QUITE_BLACK: Colors.NotQuiteBlack,
}

function promiseDelay<T>(timeoutms: number, timeoutVal: T): Promise<T> {
	return new Promise(resolve => {
		setTimeout(resolve.bind(null, timeoutVal), timeoutms);
	});
}

export function promiseRaceAll<T, U>(promises: Promise<U>[], timeoutms: number, timeoutVal: T): Promise<(U | T)[]> {
	return Promise.all(promises.map(p => {
		let raceArray = [p, promiseDelay(timeoutms, timeoutVal)]
		return Promise.race(raceArray)
	}));
}

/**
 * A function that returns the status of various fetch requests
 */
export async function getPromisesFetch<T>(initArgs: any[], maxRetries = 5): Promise<T[]> {
	if (!Array.isArray(initArgs) || !initArgs[0]) throw new Error("No arguments passed")

	let pendingRequests = initArgs.map((arg, index) => ({ arg, index }))
	const fullData: any[] = new Array(initArgs.length)
	let timesExecuted = 0

	while (pendingRequests.length > 0) {
		timesExecuted++

		if(timesExecuted > maxRetries) {
			return Promise.reject("Max retries exceeded")
		}

		const promises = pendingRequests.map(req => fetch(req.arg))
		let progress = 0

		promises.forEach(p => p.then(() => {
			progress++
			logger.debug(`Promise progress: ${((progress / promises.length) * 100).toFixed(2)}% (total: ${promises.length})`, DEBUG_LEVELS.VARIABLE_DEBUG)
		}).catch(() => {}))

		let fetchRequests

		try {
			const safePromises = promises.map(p => p.catch(() => undefined))
			fetchRequests = await promiseRaceAll(safePromises, 1000 * 60 * 1.5, null)
		} catch (e: any) {
			return Promise.reject(e.message)
		}

		const checkAgain: typeof pendingRequests = []

		for (let i = 0; i < fetchRequests.length; i++) {
			const res = fetchRequests[i]
			const { arg, index } = pendingRequests[i]

			if(!res || res instanceof Error || res.status !== 200) {
				checkAgain.push({ arg, index })
				continue
			}

			fullData[index] = await res.json()
		}

		pendingRequests = checkAgain

		if(pendingRequests.length > 0) {
			await wait(1000 * 20)
		}
	}

	return fullData
}

export function isObjectEmpty(obj: any) {
	for (let i in obj) return false
	return true
}

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), ms)
	})
}

export function differenceBetweenNumbers(number1: number, number2: number) {
	if (number1 === number2) return 0
	return Math.max(number1, number2) - Math.min(number1, number2)
}

export async function getColorPaletteFromURL(url: string) {
	if (url == null) return null
	const palette = await new Vibrant(url).getPalette()
	return palette
}

export function allIndexesOf(string: string, character: string) {
	if (string == null || character == null) return []

	let indexes = []

	string = string.replace(/(?:\r\n|\r|\n)/g, "j");

	for (let i = 0; i < string.length; i++) {
		const letter = string[i];
		if (letter === character) indexes.push(i)
	}

	return indexes
}

export async function imageUrlToBase64(url: string) {
	if (url == null) return null
	const res = await fetch(url)
	if (res.status !== 200) return null
	const arrayBuffer = await res.arrayBuffer()
	return Buffer.from(arrayBuffer).toString("base64")
}

export function numberWithCommas(x: number) {
	if (x == null) return ""
	let parts = x.toString().split(".");
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return parts.join(".");
}

export function removeSpaces(str: string): string {
	const WHITE_SPACE_REGEX = /\s/g
	return str.replace(WHITE_SPACE_REGEX, '');
}

export function isColorResolvable(str: any): str is ColorResolvable {
	return resolveLegacyColor(str) != null
}

export function resolveLegacyColor(str: unknown): ColorResolvable | null {
	if(typeof str !== "string") return null
	if(/^#([0-9A-Fa-f]{6})$/.test(str)) return str as HexColorString
	if(str === "RANDOM") return Math.floor(Math.random() * 0xffffff)
	return LEGACY_COLOR_MAP[str] ?? null
}

export function responseErrorString(res: Response) {
	return `${res.url}: (${res.status}) ${res.statusText}`
}

export function spamLetter(letter: string, times: number): string {
	if (times === 0) return ""

	let result = ""

	for (let i = 0; i < times; i++) {
		result += letter
	}

	return result
}

export async function fetchWithRetry(url: URL, { maxRetries = 5, retryDelayMS = 1000 * 30 } = {}) {
	let retries = 0

	while (retries < maxRetries) {
		try {
			const response = await fetch(url)

			if (response.ok) return response

			if (response.status === 429 || response.status === 502) {
				retries++
				await new Promise((resolve) => setTimeout(resolve, retryDelayMS))
				continue
			}

			return response
		} catch (error) {
			retries++
			logger.unknownError(error)
			await new Promise((resolve) => setTimeout(resolve, retryDelayMS))
		}
	}

	throw new Error(`Exceeded maximum number of retries (${maxRetries})`)
}

export function ReadOnlyGet(target: any, propertyKey: string) {
	const publicName = propertyKey.startsWith('_') ? propertyKey.slice(1) : propertyKey;

	Object.defineProperty(target, publicName, {
    get() {
		return this[propertyKey];
    },
		enumerable: true,
		configurable: true,
	});
}