import ES from "./lang.es.js"
import EN from "./lang.en.js"
import getConfig from "../config/getConfig.js"

const languages = {
	ES: ES,
	EN: EN
}

export const localizationToLanguage: {[key: string]: languages} = {
	"en-US": "EN",
	"en-GB": "EN",
	"es-ES": "ES",
	"es-419": "ES"
}

export const languageToLocalization: {[key in languages]: string} = {
	"EN": "en-US",
	"ES": "es-ES"
}

export type languageString = keyof typeof EN

export type languages = keyof typeof languages

export type localizationFunction = (languageString: languageString) => string

export default class getLanguage {
	static getString(localization: string | undefined, key: languageString): string {
		if(localization == null) return this.getDefault(key)
		const lang = localizationToLanguage[localization]
		if(lang) return languages[lang][key]
		return this.getDefault(key)
	}

	static defaultLocale = getConfig().language.toUpperCase() in languages
		? getConfig().language.toUpperCase() as languages :
		"EN"

	static getDefault: localizationFunction = (key: languageString) => {
		return languages[getLanguage.defaultLocale][key]
	}

	static getAll(key: languageString) {
		return Object.values(languages).map(language => language[key])
	}

	static getLocalizations(key: languageString) {
		let localizations: {[key: string]: string} = {}
		
		let language: keyof typeof languages
		
		for(language in languages) {
			if(language === "EN") continue
			if(languages[language][key]) localizations[languageToLocalization[language]] = languages[language][key]
		}

		return localizations
	}
}