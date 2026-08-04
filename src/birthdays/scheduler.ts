import { EmbedBuilder, TextChannel } from "discord.js"
import { DiscordVariables } from "../classes/sentMessageHandler.js"
import getConfig from "../config/getConfig.js"
import appContext from "../index.js"
import getLanguage from "../languages/lang.js"
import { DEBUG_LEVELS, logger } from "../logger.js"
import { ageOn, isToday } from "./dates.js"
import * as store from "./store.js"

const dateKey = (date: Date) => date.toISOString().slice(0, 10)

function nextAnnouncement(hourUTC: number, now = new Date()): Date {
	const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUTC))

	if(next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)

	return next
}

async function announce() {
	const { channelId } = getConfig().commands.birthdays

	if(!channelId) return

	const today = new Date()
	const key = dateKey(today)

	if(store.getLastAnnouncedDate() === key) return

	const celebrating = store.active().filter(({ birthday }) => isToday(birthday, today))

	await store.setLastAnnouncedDate(key)

	if(!celebrating.length) return

	const channel = await appContext.discordClient.channels.fetch(channelId).catch(() => null)

	if(!(channel instanceof TextChannel)) return logger.warn(`Birthday channel ${channelId} was not found`)

	const embed = new EmbedBuilder()
		.setTitle(`🎂 ${getLanguage.getDefault("birthdayAnnouncementTitle")}`)
		.setColor(DiscordVariables.SUCCESS_COLOR)
		.setDescription(celebrating
			.map(({ entry, birthday }) =>
				`${store.mention(entry)} ${getLanguage.getDefault("birthdayAnnouncementDescription")} **${ageOn(birthday, today)}** 🎉`)
			.join("\n"))

	await channel.send({ embeds: [embed] })
}

function schedule() {
	const next = nextAnnouncement(getConfig().commands.birthdays.announceHourUTC)

	setTimeout(async () => {
		await announce().catch(err => logger.unknownError(err))

		schedule()
	}, next.getTime() - Date.now())

	logger.debug(`Next birthday announcement scheduled for ${next.toISOString()}`, DEBUG_LEVELS.INCEPTION_DEBUG)
}

export async function start() {
	await store.load()

	if(new Date().getUTCHours() >= getConfig().commands.birthdays.announceHourUTC) {
		await announce().catch(err => logger.unknownError(err))
	}

	schedule()
}
