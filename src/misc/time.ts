import { languageToLocalization, languages } from "../languages/lang.js"

type TimeUnit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second"

const TIME_UNITS: { unit: TimeUnit; seconds: number }[] = [
	{ unit: "year", seconds: 31536000 },
	{ unit: "month", seconds: 2592000 },
	{ unit: "week", seconds: 604800 },
	{ unit: "day", seconds: 86400 },
	{ unit: "hour", seconds: 3600 },
	{ unit: "minute", seconds: 60 },
]

function formatUnit(count: number, unit: TimeUnit, locale: string) {
	return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(count)
}

export function timeSince(date: Date, depth = 1, locale: languages) {
	if (!date) throw new Error("No date specified.")

	const localeString = languageToLocalization[locale]
	let seconds = Math.floor((Date.now() - date.getTime()) / 1000)
	const parts: string[] = []

	for (const { unit, seconds: unitSeconds } of TIME_UNITS) {
		if (parts.length >= depth) break

		const count = Math.floor(seconds / unitSeconds)

		if (count >= 1) {
			parts.push(formatUnit(count, unit, localeString))
			seconds -= count * unitSeconds
		}
	}

	if (parts.length === 0) {
		parts.push(formatUnit(Math.max(seconds, 0), "second", localeString))
	}

	return new Intl.ListFormat(localeString, { type: "unit" }).format(parts)
}

export function monthName(month: number, locale: string) {
	return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" })
		.format(new Date(Date.UTC(2000, month - 1, 1)))
}

export const fullTimestamp = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}>`

export const relativeTimestamp = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:R>`
