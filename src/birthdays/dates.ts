const BIRTHDAY_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/
const MINIMUM_YEAR = 1900

export interface Birthday {
	day: number
	month: number
	year: number
}

const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

export function parseBirthday(value: string): Birthday | null {
	const match = BIRTHDAY_PATTERN.exec(value)

	if(!match) return null

	const [day, month, year] = match.slice(1).map(Number)
	const date = new Date(Date.UTC(year, month - 1, day))

	if(date.getUTCDate() !== day || date.getUTCMonth() !== month - 1 || date.getUTCFullYear() !== year) return null

	return { day, month, year }
}

export function isRealisticYear(year: number) {
	return year >= MINIMUM_YEAR && year <= new Date().getUTCFullYear()
}

export function isToday({ day, month }: Birthday, now = new Date()) {
	return now.getUTCDate() === day && now.getUTCMonth() === month - 1
}

export function nextOccurrence({ day, month }: Birthday, now = new Date()): Date {
	const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day))

	if(thisYear.getTime() >= startOfDay(now).getTime()) return thisYear

	return new Date(Date.UTC(now.getUTCFullYear() + 1, month - 1, day))
}

export function ageOn({ day, month, year }: Birthday, now = new Date()) {
	const age = now.getUTCFullYear() - year
	const beforeBirthday = now.getUTCMonth() < month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() < day)

	return beforeBirthday ? age - 1 : age
}