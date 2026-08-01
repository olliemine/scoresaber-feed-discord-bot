import { SlashCommandBuilder } from "discord.js"
import { BotCommand } from "../../commandGetter.js"
import SentMessageHandler from "../../classes/sentMessageHandler.js"
import getLanguage from "../../languages/lang.js"
import { changeName, discordIDtoMember, getDataUserFromDiscordUser, isDiscordCategories, isVisitor } from "../../discord/account/userFunctions.js"
import { idSearch } from "../../scoresaber/handlers/getScoreSaberPlayer.js"
import { checkUserCategory } from "../../scoresaber/player/playerFunctions.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand = {
	name: "changename",
	category: "User",
	categoryLocale: "userCategory",
	description: getLanguage.getDefault("changeNameDescription"),
	descriptionLocale: "changeNameDescription",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 4,
	slashCommand: new SlashCommandBuilder()
	.setName("changename")
	.setDescription(getLanguage.getDefault("changeNameDescription")).setDescriptionLocalizations(getLanguage.getLocalizations("changeNameDescription"))
	.addStringOption(option => 
		option.setName("name")
		.setDescription(getLanguage.getDefault("changeNameStringOptionDescription"))
		.setDescriptionLocalizations(getLanguage.getLocalizations("changeNameStringOptionDescription"))
		.setRequired(true)
		.setMaxLength(32)),
	async execute(message) {
		const sentMessage = await new SentMessageHandler(message).localesLoading()

		const newName = message.options.getString("name")
		
		if(!newName) return sentMessage.localesError("invalidString")
		
		const dataUser = await getDataUserFromDiscordUser(sentMessage.author)
		const discordMember = await discordIDtoMember(sentMessage.author.id)

		if(!discordMember) return sentMessage.localesError("userNotFound")
		if(!dataUser && !(await isVisitor(sentMessage.author))) return sentMessage.localesError("userYourNotFound")		
		
		let scoresaberUser

		if(dataUser) {
			const scoresaberUserRes = await idSearch(dataUser.scoresaberID, false)
			scoresaberUser = scoresaberUserRes.status === true ? scoresaberUserRes.body : undefined
		}

		const category = dataUser && scoresaberUser ? checkUserCategory(scoresaberUser, dataUser) : "Visitor"

		if(!isDiscordCategories(category)) return sentMessage.localesError("changeNameError")

		changeName({
			discordMember,
			dataUser,
			newName,
			scoresaberUser
		}, category).then(() => {
			sentMessage.success({ description: `${sentMessage.getLocalization("changeNameSuccess")}: ${newName}`})
		}).catch(error => {
			sentMessage.error({ description: `${sentMessage.getLocalization("unexpectedError")}: ${error.message}` })
		})
	},
}

export default command