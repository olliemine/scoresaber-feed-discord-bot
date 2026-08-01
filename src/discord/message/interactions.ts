import { getPromisesFetch, numberWithCommas } from "../../misc/util.js"
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, ComponentType, EmbedBuilder } from "discord.js"
import SentMessageHandler, { CommandMessage, ReplyOptions } from "../../classes/sentMessageHandler.js"
import { user } from "../../types/db.js"
import { findDataUserInString } from "../account/userFunctions.js"
import { getIDBasicFindString } from "../../scoresaber/handlers/links.js"
import { AnyScoreSaberUserBody } from "../../types/scoresaber.js"

export async function simpleYesOrNoPrompt<T extends CommandMessage>(
	content: ReplyOptions<T>,
	sentMessage: SentMessageHandler<T>,
	{ time = 120, endprompt = "Closed." , onlyAuthor = false }: { time?: number, endprompt?: string | ReplyOptions<T>, onlyAuthor: boolean }
): Promise<SentMessageHandler<T>> {	
	
	const row = new ActionRowBuilder<ButtonBuilder>()
	.addComponents(
		new ButtonBuilder()
			.setCustomId(`yes`)
			.setEmoji("✅")
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(`no`)
			.setEmoji("❎")
			.setStyle(ButtonStyle.Danger)
	)

	content.components = [row]
	
	await sentMessage.postOptions(content)

	return await new Promise((resolve, reject) => {
		if(!sentMessage.message) return
		const buttoncollector = sentMessage.message.createMessageComponentCollector({ componentType: ComponentType.Button, time: (1000 * time)})
		
		buttoncollector.on("collect", (i) => {
			if(onlyAuthor && i.user.id !== sentMessage.author.id) return 
			
			buttoncollector.stop()	
			switch (i.customId) {
				case "yes":
					resolve(sentMessage)
					break
				case "no":
					reject(sentMessage)
					break
			}
		})

		buttoncollector.once("end", () => {
			if(!endprompt) return

			if(typeof endprompt === "string") {
				sentMessage.postOptions({embeds: [], components: [], content: endprompt})
				return
			}

			sentMessage.postOptions(endprompt)
		})
	})	
}

export async function userSelection<T extends CommandMessage>(
	users: user[],
	sentMessage: SentMessageHandler<T>,
	typeOfUsers: "dataUsers"
): Promise<user | null>
export async function userSelection<T extends CommandMessage>(
	users: AnyScoreSaberUserBody[],
	sentMessage: SentMessageHandler<T>,
	typeOfUsers: "scoresaberUsers"
): Promise<AnyScoreSaberUserBody | null>
export async function userSelection<T extends CommandMessage>(
	users: AnyScoreSaberUserBody[] | user[],
	sentMessage: SentMessageHandler<T>,
	typeOfUsers: "scoresaberUsers" | "dataUsers"
) {
	let embeds: EmbedBuilder[] = []
	
	let scoresaberUsers: AnyScoreSaberUserBody[]
	
	if(typeOfUsers === "scoresaberUsers") scoresaberUsers = users as AnyScoreSaberUserBody[]
	else {
		const dataUsers = users as user[]
		scoresaberUsers = await getPromisesFetch(dataUsers.map((user) => getIDBasicFindString(user["scoresaberID"])))
	}
	
	scoresaberUsers.forEach((user) => {
		const embed = new EmbedBuilder()
		.setColor(Colors.Grey)
		.setTitle("Multiple users")
		.setDescription(`${sentMessage.getLocalization("userSelectionDescription")}\n\nName: ${user.name}\nRank: #${numberWithCommas(user.stats.rank)}\nPP: ${numberWithCommas(parseFloat(user.stats.totalPP.toFixed(2)))}pp`)
		.setThumbnail(user.avatar)
		embeds.push(embed)
	})
	
	const row = new ActionRowBuilder<ButtonBuilder>()
	.addComponents(
		new ButtonBuilder()
			.setCustomId(`correct`)
			.setLabel("Correct")
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(`incorrect`)
			.setLabel("Incorrect")
			.setStyle(ButtonStyle.Danger)
	)
	
	let page = 0

	return await new Promise(async (resolve, reject) => {
		await sentMessage.postOptions({embeds: [embeds[page]], components: [row], content: undefined})

		if(!sentMessage.message) return reject()

		const buttoncollector = sentMessage.message.createMessageComponentCollector({ componentType: ComponentType.Button, time: (1000*60)*1.5})

		buttoncollector.on("collect", async (i) => {
			if (i.user.id !== sentMessage.author.id) return 

			switch (i.customId) {
				case "correct":
					buttoncollector.stop()
					sentMessage.postOptions({ components: [] })
					resolve(users[page])
					break
				case "incorrect":
					if(page === users.length - 1) {
						buttoncollector.stop()
						sentMessage.localesError("userSelectionNotFound")
						return resolve(null)
					}

					page++
					sentMessage.postOptions({embeds: [embeds[page]], components: [row]})
					break
			}

			i.deferUpdate()
		})
	})
}

export async function findDataUserInArgs(args: string, sentMessage: SentMessageHandler): Promise<user | null> {
	let dataUser = await findDataUserInString(args)

	if(dataUser == null) {
		sentMessage.localesError("userNotFound")
		return null
	}
		
	if(Array.isArray(dataUser) && dataUser.length === 1) dataUser = dataUser[0]
	if(Array.isArray(dataUser)) dataUser = await userSelection(dataUser, sentMessage, "dataUsers")
	if(dataUser == null) return null
	return dataUser
}

export async function unexpectedErrorInteractionHandler(err: unknown, sentMessage: SentMessageHandler) {	
	if(err instanceof Error) {
		return await sentMessage.error({ description: `${sentMessage.getLocalization("unexpectedError")}: ${err.message}`})
	}

	return await sentMessage.error({ description: sentMessage.getLocalization("unexpectedError") })
}
