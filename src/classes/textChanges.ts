import getLanguage, { localizationFunction } from "../languages/lang.js"
import { spamLetter } from "../misc/util.js"

export default class TextChanges {
	private text: {
		value: string,
		level: number
	}[] = []

	private _textCount: number = 0
	
	public localization: localizationFunction

	constructor(localization?: localizationFunction) {
		this.localization = localization ?? getLanguage.getDefault
		return this
	}

	public addText(value: string, level = 0) {
		this.text.push({ value, level })
		this._textCount++
		return this
	}

	public addLineBreak() {
		return this.addText("\n", 0)
	}

	public getText({ addLineBreaks = true, bulletPoints = true } = {}) {
		if(this._textCount === 0) return "" 

		const uniqueLevels = [...new Set(this.text.filter(v => v.value !== "\n").map(v => v.level))]

		const levelsMap = uniqueLevels.sort((a, b) => a - b)
			.reduce<{ [key: string]: number }>((map, level, index) => (map[level.toString()] = index, map), {})

		return this.text.map((v) => {
			return {
				value: v.value,
				level: levelsMap[v.level.toString()]
			}
		}).reduce((acc, value, i, arr) => acc +
			(
				value.value === "\n" ? value.value : (
					(
						arr[i - 1] != undefined &&
						arr[i - 1].level > value.level &&
						addLineBreaks === true ?
						"\n" : ""
					) +
					(
						bulletPoints ?
						spamLetter(" ", value.level * 2) + "- " :
						spamLetter("\t", value.level)
					) +
					value.value
				)
			) +
			"\n", ""
		)
	}

	public combine(...changes: TextChanges[]) {
		changes.forEach((change) => {
			this.text = [...this.text, ...change.text]
			this._textCount += change._textCount
		})
		
		return this
	}

	public get textCount() {
		return this._textCount
	}

	public warnings = {
		addChangeName: (err?: string) => this.addText(`${this.localization("changeNameError")}${err ? `: ${err}` : ""}`, 1),
		addWarningRoles: (roles: string[]) => this.addText(`${this.localization("rolesError")}: ${roles.join(", ")}`, 1)
	}
}