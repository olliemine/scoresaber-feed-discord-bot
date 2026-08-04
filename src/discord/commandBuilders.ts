import { SlashCommandSubcommandBuilder } from "discord.js"
import getLanguage, { languageString } from "../languages/lang.js"

export const localizedSubcommand = (name: string, description: languageString) => (option: SlashCommandSubcommandBuilder) => option
	.setName(name)
	.setDescription(getLanguage.getDefault(description))
	.setDescriptionLocalizations(getLanguage.getLocalizations(description))
