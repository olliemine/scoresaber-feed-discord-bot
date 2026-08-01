import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler, { DiscordVariables } from "../../classes/sentMessageHandler.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import { login } from "../../discord/account/login.js"
import { discordIDtoMember } from "../../discord/account/userFunctions.js"
import { removeSpaces } from "../../misc/util.js"
import TextChanges from "../../classes/textChanges.js"
import { ColorResolvable } from "discord.js"
import { languageString } from "../../languages/lang.js"

const command: BotCommand = {
	name: "amultilink",
	category: "Admin",
	description: "Force a login on users",
	level: COMMAND_PERMISSIONS.ADMIN,
	cooldown: 5,
	slashCommand: new SlashCommandBuilder()
	.setName("amultilink")
	.setDescription("Force a login on users")
	.addStringOption(option => option.setName("discord_users")
		.setDescription("The ids of the users that will be logged in, seperated by a (,)")
		.setRequired(true))
	.addStringOption(option => option.setName("scoresaber_players")
		.setDescription("The scoresaber ids of the users that will be logged in, seperated by a (,)")
		.setRequired(true)),
	async execute(message) {
		const discordUsers = message.options.getString("discord_users")?.split(",")

		const scoresaberPlayers = message.options.getString("scoresaber_players")?.split(",")
		
		if(!scoresaberPlayers || !discordUsers || discordUsers.length !== scoresaberPlayers.length)
			return new SentMessageHandler(message).localesError("invalidString")

		if(discordUsers.length === 0) return new SentMessageHandler(message).error({ description: ""})

		const sentMessage = await new SentMessageHandler(message).loading()

		const text = new TextChanges()

		const updatingInterval = setInterval(() => {
			sentMessage.loading({ 
				description: `Linking users... ${text.textCount}/${discordUsers.length} ${DiscordVariables.LOADING_EMOJI}\n${text.getText()}`,
				footer: {
					text: "Warning: If using the names of scoresaber user accounts to link, and if multiple users are found, the bot will not attempt a link"
				}
			
			})
		}, 1000*1.5)

		let results: boolean[] = []

		for await(const [index, discordUserID] of discordUsers.entries()) {
			const discordMember = await discordIDtoMember(removeSpaces(discordUserID))
			
			if(!discordMember) {
				text.addText(`Did not find user ${discordUserID}`)
				continue
			}

			const res = await login(scoresaberPlayers[index], discordMember, sentMessage.getLocalization)

			text.addText(res.adminMessage)

			results.push(res.isSuccessful)
		}

		clearInterval(updatingInterval)

		const amountOfUnsuccesfulls = results.filter(a => a === false).length

		const RESPONSES: {[key in "ERROR" | "WARNING" | "SUCCESS"]: {
			color: ColorResolvable,
			title: languageString
		}} = {
			ERROR: {
				color: DiscordVariables.ERROR_COLOR,
				title: "errorTitle"
			},
			WARNING: {
				color: DiscordVariables.WARNING_COLOR,
				title: "partialSuccessTitle"
			},
			SUCCESS: {
				color: DiscordVariables.SUCCESS_COLOR,
				title: "successTitle"
			}
		}

		const responseType = amountOfUnsuccesfulls === results.length ? "ERROR" :
			amountOfUnsuccesfulls > 0 ? "WARNING" : "SUCCESS"

		sentMessage.normal({
			color: RESPONSES[responseType].color,
			title: sentMessage.getLocalization(RESPONSES[responseType].title),
			description: `Finished linking users ${discordUsers.length}/${discordUsers.length}\n${text.getText()}`
		})
	},
}

export default command