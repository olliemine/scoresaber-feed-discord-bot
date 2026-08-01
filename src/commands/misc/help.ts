import { Colors, EmbedBuilder } from "discord.js"
import { BotCommand, commands } from "../../commandGetter.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { checkLevel, discordIDtoMember } from "../../discord/account/userFunctions.js"

const getUniqueCategories = (commands: (BotCommand & {
	category: string
})[]) => [...new Set(commands.map(command => command.category))].length

const command: BotCommand = {
	name : "help",
	category: null,
	description: "AYUDAA!! HELP MEE!!",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 2,
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()
		const discordMember = await discordIDtoMember(sentMessage.author.id)
		const userLevel = discordMember ? checkLevel(sentMessage.author.id, discordMember) : COMMAND_PERMISSIONS.BASE

		let formatedCommands = Object.values(commands).filter(command => 
			command.category &&
			command.level <= userLevel) as (BotCommand & {
				category: string
			})[]

		formatedCommands.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
		
		let pages: { embeds: [EmbedBuilder]}[] = []
		
		let commandsSortedbyCategory: {[key: string]: (BotCommand & {
				category: string
			})[]} = {}
		
		formatedCommands.forEach(command => {
			if(!commandsSortedbyCategory[command.category]) commandsSortedbyCategory[command.category] = []
			commandsSortedbyCategory[command.category].push(command)
		})
		
		let commandsSortedbyCategoryArr = Object.values(commandsSortedbyCategory)
		
		const uniqueCategories = getUniqueCategories(formatedCommands)
		
		commandsSortedbyCategoryArr.forEach((commands, i) => {
			const embed = new EmbedBuilder()
			.setTitle(commands[0].categoryLocale ? sentMessage.getLocalization(commands[0].categoryLocale) : commands[0].category)
			.setFooter({text: `${i+1}/${uniqueCategories}`})
			.setColor(Colors.Blurple)

			const fields = commands.map(command => ({
				name: `/${command.name}`,
				value: `${command.descriptionLocale ? sentMessage.getLocalization(command.descriptionLocale) : command.description}`,
				inline: true
			}))
			
			embed.addFields(...fields)
			
			pages.push({embeds: [embed]})
		})

		sentMessage.simplePageMenu(pages, { endPrompt: `Help ${sentMessage.getLocalization("closed")}`, time: 60*5 })
	},
}

export default command
