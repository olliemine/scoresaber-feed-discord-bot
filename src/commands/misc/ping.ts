import SentMessageHandler from "../../classes/sentMessageHandler.js"
import { BotCommand } from "../../commandGetter.js"
import { scoresaberAPI, version } from "../../constants.js"
import appContext from "../../index.js"
import { COMMAND_PERMISSIONS } from "../../types/util.js"

const command: BotCommand =  {
	name : "ping",
	category: "Utility",
	description: "pong",
	level: COMMAND_PERMISSIONS.BASE,
	cooldown: 2,
	async execute(message) {
		const botms = Date.now() - message.createdTimestamp

		const discordms = appContext.discordClient.ws.ping
	
		const scoresaberapims = async () => {
			const timer = Date.now()
			const json = await fetch(scoresaberAPI + "/player/76561199006338762/scores?sort=recent&page=1")
			if (json.status != 200 && json.status != 429)
				return `Offline | ${json.statusText}`
			return Date.now() - timer + "ms"
		}

		new SentMessageHandler(message).normal({
			color: "#e2330d",
			description: `Bot Latency: ${botms}ms\nDiscord API Latency: ${discordms}ms\nScoresaber API Latency: ${await scoresaberapims()}`,
			footer: {
				text: `Made by olliemine | ${version}`
			}
		})
	},
}

export default command