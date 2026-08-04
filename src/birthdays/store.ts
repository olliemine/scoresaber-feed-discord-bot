import { getJSON, writeJSON } from "../misc/jsonController.js"
import { BirthdayData, BirthdayEntry } from "../types/birthdays.js"
import { Birthday, parseBirthday } from "./dates.js"

let data: BirthdayData = { birthdays: [] }

export async function load() {
	data = await getJSON("birthdays")
}

async function save() {
	await writeJSON("birthdays", data)
}

export function find(username: string, discordID: string): BirthdayEntry | undefined {
	return data.birthdays.find(entry => entry.discordID === discordID) ??
		data.birthdays.find(entry => entry.username === username)
}

export function active(): { entry: BirthdayEntry, birthday: Birthday }[] {
	return data.birthdays.flatMap(entry => {
		if(entry.banned || !entry.birthday) return []

		const birthday = parseBirthday(entry.birthday)

		return birthday ? [{ entry, birthday }] : []
	})
}

export async function set(username: string, discordID: string, birthday: string) {
	const entry = find(username, discordID)

	if(entry) {
		entry.username = username
		entry.discordID = discordID
		entry.birthday = birthday
	} else {
		data.birthdays.push({ username, discordID, birthday, banned: false })
	}

	await save()
}

export async function clear(entry: BirthdayEntry) {
	entry.birthday = ""

	await save()
}

export async function ban(username: string, discordID: string) {
	const entry = find(username, discordID)

	if(entry) {
		entry.username = username
		entry.discordID = discordID
		entry.banned = true
	} else {
		data.birthdays.push({ username, discordID, birthday: "", banned: true })
	}

	await save()
}

export const getLastAnnouncedDate = () => data.lastAnnouncedDate

export async function setLastAnnouncedDate(date: string) {
	data.lastAnnouncedDate = date

	await save()
}

export const mention = (entry: BirthdayEntry) => entry.discordID ? `<@${entry.discordID}>` : `**${entry.username}**`
