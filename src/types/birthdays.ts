export interface BirthdayEntry {
	username: string
	discordID?: string
	birthday: string
	banned: boolean
}

export interface BirthdayData {
	birthdays: BirthdayEntry[]
	lastAnnouncedDate?: string
}
