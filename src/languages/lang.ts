import ES from "./lang.es.js"
import EN from "./lang.en.js"
import DE from "./lang.de.js"
import getConfig from "../config/getConfig.js"
import { logger } from "../logger.js"

/**
 * If you don't have a translation yet set it to "" (empty string)
 * At runtime that key falls back to EN
 * 
 * EN itself should never use ""
 */

const languages = {
	ES,
	EN,
	DE
} satisfies Record<string, LanguageMessages>

export const localizationToLanguage: {[key: string]: languages} = {
	"en-US": "EN",
	"en-GB": "EN",
	"es-ES": "ES",
	"es-419": "ES",
	"de": "DE",
	"de-DE": "DE"
}

export const languageToLocalization: {[key in languages]: string} = {
	"EN": "en-US",
	"ES": "es-ES",
	"DE": "de"
}

export type LanguageMessages = Record<keyof typeof EN, string>

export type languageString = keyof typeof EN

export type languages = keyof typeof languages

export type localizationFunction = (languageString: languageString) => string

function isPresent(value: string | undefined): value is string {
	return value != null && value !== ""
}

function resolveFromLang(lang: languages, key: languageString): string | undefined {
	const value = languages[lang][key]
	return isPresent(value) ? value : undefined
}

const noAvailableLanguageKey = (key: languageString) => logger.error(`Language key (${key}) does not have any available translations`)

export default class getLanguage {
	static getString(localization: string | undefined, key: languageString): string {
		if(localization == null) return this.getDefault(key)
		
		const lang = localizationToLanguage[localization]
		
		if(lang) { 
			const value = resolveFromLang(lang, key)
			if(value) return value
		}

		return this.getDefault(key)
	}

	static defaultLocale = getConfig().language.toUpperCase() in languages
		? getConfig().language.toUpperCase() as languages :
		"EN"

	static getDefault: localizationFunction = (key: languageString) => {
		const value = resolveFromLang(getLanguage.defaultLocale, key) ?? resolveFromLang("EN", key)
		
		if(value == undefined) noAvailableLanguageKey(key)

		return value ?? key
	}

	static getAll(key: languageString) {
		return Object.values(languages)
		.map(language => language[key])
		.filter(isPresent)
	}

	static getLocalizations(key: languageString) {
		let localizations: {[key: string]: string} = {}
		
		let language: keyof typeof languages
		
		for(language in languages) {
			if(language === "EN") continue

			const value = resolveFromLang(language, key)

			if(value) localizations[languageToLocalization[language]] = value
		}

		return localizations
	}
}