import { ChatInputCommandInteraction, Colors, EmbedBuilder, SlashCommandBuilder } from "discord.js"
import { isRealisticYear, isToday, monthName, nextOccurrence, parseBirthday, relativeTimestamp } from "../../birthdays/dates.js"
import * as store from "../../birthdays/store.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { BotCommand } from "../../commandGetter.js"
import { localizedSubcommand } from "../../discord/commandBuilders.js"
import { hasPermissionLevel } from "../../discord/account/userFunctions.js"
import getLanguage, { languageToLocalization } from "../../languages/lang.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

type BirthdayMessage = SentMessageHandler<ChatInputCommandInteraction>

const ENTRIES_PER_PAGE = 20
const UPCOMING_LIMIT = 15
const BIRTHDAY_COLOR = Colors.Gold

const localization = getLanguage.getDefault
const SERVER_LOCALE = languageToLocalization[getLanguage.defaultLocale]

function formatDay(day: number, month: number) {
	return `${day} ${monthName(month, SERVER_LOCALE)}`
}

async function readBirthdayOption(message: ChatInputCommandInteraction, sentMessage: BirthdayMessage) {
	const input = message.options.getString("birthday", true)
	const parsed = parseBirthday(input)

	if(!parsed) {
		await sentMessage.defaultError("birthdayInvalidFormat")
		return null
	}

	if(!isRealisticYear(parsed.year)) {
		await sentMessage.defaultError("birthdayInvalidYear")
		return null
	}

	return { input, parsed }
}

async function handleAdd(message: ChatInputCommandInteraction, sentMessage: BirthdayMessage) {
	const birthday = await readBirthdayOption(message, sentMessage)

	if(!birthday) return

	const existing = store.find(sentMessage.author.username, sentMessage.author.id)

	if(existing?.banned) return await sentMessage.defaultError("birthdayBanned")
	if(existing?.birthday) return await sentMessage.defaultError("birthdayAlreadyRegistered")

	await store.set(sentMessage.author.username, sentMessage.author.id, birthday.input)

	await sentMessage.success({
		description: `${localization("birthdayAdded")}: ${formatDay(birthday.parsed.day, birthday.parsed.month)}`
	})
}

async function handleEdit(message: ChatInputCommandInteraction, sentMessage: BirthdayMessage) {
	const existing = store.find(sentMessage.author.username, sentMessage.author.id)

	if(existing?.banned) return await sentMessage.defaultError("birthdayBanned")
	if(!existing?.birthday) return await sentMessage.defaultError("birthdayNotRegistered")

	const birthday = await readBirthdayOption(message, sentMessage)

	if(!birthday) return

	await store.set(sentMessage.author.username, sentMessage.author.id, birthday.input)

	await sentMessage.success({
		description: `${localization("birthdayUpdated")}: ${formatDay(birthday.parsed.day, birthday.parsed.month)}`
	})
}

async function handleDelete(sentMessage: BirthdayMessage) {
	const existing = store.find(sentMessage.author.username, sentMessage.author.id)

	if(existing?.banned) return await sentMessage.defaultError("birthdayBanned")
	if(!existing?.birthday) return await sentMessage.defaultError("birthdayNotRegistered")

	await store.clear(existing)

	await sentMessage.defaultSuccess("birthdayDeleted")
}

async function handleBan(message: ChatInputCommandInteraction, sentMessage: BirthdayMessage) {
	if(!await hasPermissionLevel(sentMessage.author.id, COMMAND_PERMISSIONS.ADMIN)) {
		return await sentMessage.defaultError("commandNotEnoughPermissions")
	}

	const target = message.options.getUser("user", true)

	await store.ban(target.username, target.id)

	await sentMessage.success({ description: `<@${target.id}> ${localization("birthdayUserBanned")}` })
}

async function handleList(sentMessage: BirthdayMessage) {
	await sentMessage.loading()

	const title = `📅 ${localization("birthdayListTitle")}`

	const entries = store.active()
		.sort((first, second) => first.birthday.month - second.birthday.month || first.birthday.day - second.birthday.day)

	if(!entries.length) return await sentMessage.normal({
		title,
		description: localization("birthdayListEmpty"),
		color: BIRTHDAY_COLOR
	})

	const totalPages = Math.ceil(entries.length / ENTRIES_PER_PAGE)
	const pages: { embeds: [EmbedBuilder] }[] = []

	for(let index = 0; index < entries.length; index += ENTRIES_PER_PAGE) {
		let description = ""
		let currentMonth = 0

		for(const { entry, birthday } of entries.slice(index, index + ENTRIES_PER_PAGE)) {
			if(birthday.month !== currentMonth) {
				currentMonth = birthday.month
				description += `${description ? "\n" : ""}**${monthName(birthday.month, SERVER_LOCALE)}**\n`
			}

			description += `• ${store.mention(entry)} — ${birthday.day}\n`
		}

		pages.push({
			embeds: [new EmbedBuilder()
				.setTitle(title)
				.setColor(BIRTHDAY_COLOR)
				.setDescription(description.trim())
				.setFooter({
					text: `${localization("page")} ${pages.length + 1}/${totalPages} — ${entries.length} ${localization("birthdayRegisteredCount")}`
				})]
		})
	}

	await sentMessage.simplePageMenu(pages, {
		endPrompt: `${localization("birthdayListTitle")} ${localization("closed")}`,
		time: 60 * 5
	})
}

async function handleRecent(sentMessage: BirthdayMessage) {
	const title = `🎂 ${localization("birthdayRecentTitle")}`

	const entries = store.active()

	if(!entries.length) return await sentMessage.normal({
		title,
		description: localization("birthdayListEmpty"),
		color: BIRTHDAY_COLOR
	})

	const upcoming = entries
		.map(item => ({ ...item, next: nextOccurrence(item.birthday) }))
		.sort((first, second) => first.next.getTime() - second.next.getTime())
		.slice(0, UPCOMING_LIMIT)

	const description = upcoming.map(({ entry, birthday, next }) => {
		const when = isToday(birthday) ? `**${localization("birthdayToday")}** 🎉` : relativeTimestamp(next)

		return `• ${store.mention(entry)} — ${formatDay(birthday.day, birthday.month)} (${when})`
	}).join("\n")

	await sentMessage.normal({
		title,
		description,
		color: BIRTHDAY_COLOR,
		footer: { text: `${entries.length} ${localization("birthdayRegisteredCount")}` }
	})
}

const command: BotCommand = {
	name: "birthday",
	category: "Utility",
	description: getLanguage.getDefault("birthdayDescription"),
	descriptionLocale: "birthdayDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 3,
	slashCommand: new SlashCommandBuilder()
		.setName("birthday")
		.setDescription(getLanguage.getDefault("birthdayDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("birthdayDescription"))
		.addSubcommand(option => localizedSubcommand("add", "birthdayAddDescription")(option)
			.addStringOption(text => text
				.setName("birthday")
				.setDescription(getLanguage.getDefault("birthdayDateOptionDescription"))
				.setDescriptionLocalizations(getLanguage.getLocalizations("birthdayDateOptionDescription"))
				.setRequired(true)))
		.addSubcommand(option => localizedSubcommand("edit", "birthdayEditDescription")(option)
			.addStringOption(text => text
				.setName("birthday")
				.setDescription(getLanguage.getDefault("birthdayDateOptionDescription"))
				.setDescriptionLocalizations(getLanguage.getLocalizations("birthdayDateOptionDescription"))
				.setRequired(true)))
		.addSubcommand(localizedSubcommand("delete", "birthdayDeleteDescription"))
		.addSubcommand(option => localizedSubcommand("ban", "birthdayBanDescription")(option)
			.addUserOption(user => user
				.setName("user")
				.setDescription(getLanguage.getDefault("birthdayUserOptionDescription"))
				.setDescriptionLocalizations(getLanguage.getLocalizations("birthdayUserOptionDescription"))
				.setRequired(true)))
		.addSubcommand(localizedSubcommand("list", "birthdayListDescription"))
		.addSubcommand(localizedSubcommand("recent", "birthdayRecentDescription")),
	async execute(message) {
		const sentMessage = new SentMessageHandler(message)

		switch(message.options.getSubcommand()) {
			case "add": return await handleAdd(message, sentMessage)
			case "edit": return await handleEdit(message, sentMessage)
			case "delete": return await handleDelete(sentMessage)
			case "ban": return await handleBan(message, sentMessage)
			case "list": return await handleList(sentMessage)
			case "recent": return await handleRecent(sentMessage)
			default: return await sentMessage.defaultError("invalidCommand")
		}
	}
}

export default command
