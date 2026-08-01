import { logger, DEBUG_LEVELS } from './logger.js'
import getConfig from './config/getConfig.js'
import { languageString } from './languages/lang.js'
import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js'
import changeNameCommand from './commands/account/changeName.js'
import loginCommand from './commands/account/link.js'
import logoutCommand from './commands/account/unlink.js'
import updateCommand from './commands/account/update.js'
import pingCommand from './commands/misc/ping.js'
import improvePlaylistCommand from './commands/playlist_generation/improveplaylist.js'
import snipePlaylistCommand from './commands/playlist_generation/snipeplaylist.js'
import top1PlaylistCommand from './commands/playlist_generation/top1playlist.js'
import top1ServerPlaylistCommand from './commands/playlist_generation/top1serverplaylist.js'
import getCommand from './commands/scoresaber/getPlayer.js'
import deleteAllCommand from './commands/master/deleteAll.js'
import aLoginCommand from "./commands/admin/alogin.js"
import aLogoutCommand from "./commands/admin/alogout.js"
import changeCountryCommand from "./commands/admin/changeCountry.js"
import aMultiLoginCommand from "./commands/admin/aMultiLogin.js"
import resetPlaysNumbersCommand from "./commands/temp_fix/resetPlaysNumbers.js"
import helpCommand from "./commands/misc/help.js"
import { COMMAND_PERMISSIONS } from './types/util.js'

let commands: {[key: string]: BotCommand} = {}
let slashCommands: any[] = []

export type BotCommand = {
	name: string,
	category: string | null,
	categoryLocale?: languageString,
	description: string,
	descriptionLocale?: languageString,
	level: COMMAND_PERMISSIONS,
	/**
	 * Seconds for the command to cooldown, bypassed by a level 2 permission
	 */
	cooldown: number,
	slashCommand?: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
	autocomplete?: (interaction: AutocompleteInteraction) => any,
	execute: (interaction: ChatInputCommandInteraction) => any
}

async function start() {
	const fileDatas = [
		changeNameCommand,
		loginCommand,
		logoutCommand,
		updateCommand,
		pingCommand,
		improvePlaylistCommand,
		snipePlaylistCommand,
		top1PlaylistCommand,
		top1ServerPlaylistCommand,
		getCommand,
		deleteAllCommand,
		aLoginCommand,
		aLogoutCommand,
		changeCountryCommand,
		aMultiLoginCommand,
		resetPlaysNumbersCommand,
		helpCommand
	]

	const disabling = getConfig().commands.disabling

	for await (const fileData of fileDatas) {
		if(!fileData || !fileData.name || !fileData.execute) {
			logger.warn(`Unknown file dectected, no name or execute found. Did you try to make your own command?`)
			continue
		}

		if(disabling && disabling.findIndex(commandName => commandName === fileData.name.toLowerCase()) !== -1) continue
		
		if(commands[fileData.name]) {
			logger.warn("Invalid command name or repeated command name, not taking " + fileData.name + " into account")
			continue
		}

		commands[fileData.name.toLowerCase()] = fileData
	}

	Object.values(commands).forEach(command => {				
		const slashcomm = command.slashCommand ?? new SlashCommandBuilder()
		.setName(command.name.toLowerCase())
		.setDescription(command.description || command.name)
		
		slashCommands.push(slashcomm.toJSON())
	})
	

	logger.debug(`${Object.keys(commands).length} commands loaded successfully`, DEBUG_LEVELS.INCEPTION_DEBUG)
}

export {
	start,
	commands,
	slashCommands
}