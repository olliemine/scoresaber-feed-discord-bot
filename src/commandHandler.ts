import { logger, DEBUG_LEVELS } from './logger.js'
import chalk from "chalk"
import { AutocompleteInteraction, ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js"
import { commands } from "./commandGetter.js"
import appContext from "./index.js"
import getConfig from './config/getConfig.js'
import SentMessageHandler from './classes/sentMessageHandler.js'
import { checkLevel, discordIDtoMember } from './discord/account/userFunctions.js'
import { COMMAND_PERMISSIONS } from './types/util.js'

let recentlyExecuted: string[] = []

let stats = {
	commandsExecuted: 0,
	commandsDenied: 0,
	errors: 0
}

function checkChannels(channelID: string) {
	const channels = getConfig()['bot-channels']

	if(!channels.length) return true
	
	return channels.includes(channelID)
}

export async function handleCommand(message: ChatInputCommandInteraction) {
	if(!appContext.hasStarted) return
	
	const commandName = message.commandName

	if(!commands) return

	const command = commands[commandName]

	if(!command) return

	const member = await discordIDtoMember(message.user.id)

	const userLevel = member ? checkLevel(member.user.id, member) : COMMAND_PERMISSIONS.BASE

	if(userLevel === COMMAND_PERMISSIONS.MASTER) return executeCommand(command, message)
	
	if(userLevel === COMMAND_PERMISSIONS.BASE && getConfig().commands.disableCommandsForBaseUsers === true) return

	const sentMessage = new SentMessageHandler(message)
	
	if(userLevel <= COMMAND_PERMISSIONS.BASE && !checkChannels(message.channelId)) {
		sentMessage.postOptions({ embeds: [new EmbedBuilder().setTitle(sentMessage.getLocalization("incorrectChannel"))], ephemeral: true })
		return
	}
		
	if(command.level > userLevel) {
		sentMessage.localesNormal("commandNotEnoughPermissions")
		logger.warn(`Discord user ${message.user.username} tried to execute a higher level command, but is unable to.`)
		stats.commandsDenied++
		return
	}

	const cooldownString = `${message.user.id}-${commandName}`
	
	if(command.cooldown > 0 && recentlyExecuted.includes(cooldownString)) {
		stats.commandsDenied++
		sentMessage.localesNormal("commandTimeout")
		return
	}

	if(command.cooldown > 0) {
		recentlyExecuted.push(cooldownString)
		setTimeout(() => {
			recentlyExecuted = recentlyExecuted.filter((text) => {
				return text != cooldownString
			})
		}, 1000 * command.cooldown)
	}
	
	executeCommand(command, message)
}

function executeCommand(command: any, message: ChatInputCommandInteraction) {
	stats.commandsExecuted++
	
	command.execute(message).catch((error: Error) => {
		const embed = new EmbedBuilder().setColor(Colors.Red).setTitle("Unexpected error").setDescription(`bot had a seizure and died :( \n${error.message}`)
		
		if(message.channel?.isSendable()) message.channel.send({embeds: [embed]})
		
		logger.error(`unhandledError ${error.stack}\n\n${chalk.bold("If this keeps happening please contact olliemine")}`)
		
		stats.errors++
	})
}

export async function autocompleteHandler(interaction: AutocompleteInteraction) {
	if(!commands) return

	const command = commands[interaction.commandName]
	
	if(!command || !command.autocomplete) return
	
	try {
		await command.autocomplete(interaction)
	} catch(err) {
		logger.unknownError(err)
		if(!interaction.responded) await interaction.respond([]).catch(() => {})
	}
}
