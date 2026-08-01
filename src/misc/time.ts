import { languages } from "../languages/lang.js"

type times = "year" | "month" | "week" | "day" | "hour" | "minute" | "second"

const timeSinceLocaleSpace: { [key in languages]: string } = {
	EN: ", ",
	ES: " y "
}

const timeSinceLocaleValues: { [key in times]: { [key in languages]: { value: string, multiple: string } } } = {
	year: {
		EN: {
			value: "year",
			multiple: "s"
		},
		ES: {
			value: "año",
			multiple: "s"
		}
	},
	month: {
		EN: {
			value: "month",
			multiple: "s"
		},
		ES: {
			value: "mes",
			multiple: "es"
		}
	},
	week: {
		EN: {
			value: "week",
			multiple: "s"
		},
		ES: {
			value: "semana",
			multiple: "s"
		}
	},
	day: {
		EN: {
			value: "day",
			multiple: "s"
		},
		ES: {
			value: "dia",
			multiple: "s"
		}
	},
	hour: {
		EN: {
			value: "hour",
			multiple: "s"
		},
		ES: {
			value: "hora",
			multiple: "s"
		}
	},
	minute: {
		EN: {
			value: "minute",
			multiple: "s"
		},
		ES: {
			value: "minuto",
			multiple: "s"
		}
	},
	second: {
		EN: {
			value: "second",
			multiple: "s"
		},
		ES: {
			value: "segundo",
			multiple: "s"
		}
	}
}

class timeSinceRecursion {
	private seconds: number
	private recursionDepth: number
	private putTrailingSpace: boolean = false
	private locale: languages
	private value?: string

	constructor(seconds: number, recursionDepth: number, locale: languages) {
		this.seconds = seconds
		this.recursionDepth = recursionDepth
		this.locale = locale
	}

	private timeSinceLocale(interval: number, times: times) {
		const roundNumber = Math.floor(interval)

		const timeSinceLocaleValue = timeSinceLocaleValues[times][this.locale]

		const timeUnit = timeSinceLocaleValue.value + (roundNumber === 1 ? "" : timeSinceLocaleValue.multiple)

		const value = `${this.putTrailingSpace ? timeSinceLocaleSpace[this.locale] : ""}${roundNumber.toString()} ${timeUnit}`

		this.putTrailingSpace = true

		return value
	}

	public get() {
		if(this.value) return this.value

		this.value = this._get()

		return this.value
	}

	private _get(): string {
		this.recursionDepth--
		if (this.recursionDepth === 0) return ""

		const TIME_UNITS: { name: times, in_seconds: number }[] = [{
			name: "year",
			in_seconds: 31536000
		}, {
			name: "month",
			in_seconds: 2592000
		}, {
			name: "week",
			in_seconds: 604800
		}, {
			name: "day",
			in_seconds: 86400
		}, {
			name: "hour",
			in_seconds: 3600
		}, {
			name: "minute",
			in_seconds: 60
		}]

		for (const UNIT of TIME_UNITS) {
			const interval = this.seconds / UNIT.in_seconds

			if (interval > 1) {
				const roundNumber = Math.floor(interval)
				
				this.seconds = this.seconds - roundNumber * UNIT.in_seconds

				return this.timeSinceLocale(interval, UNIT.name) + this._get()
			}
		}

		return this.timeSinceLocale(this.seconds, "second")
	}
}

export function timeSince(date: Date, depth = 1, locale: languages) {
	if (!date) throw new Error("No date specified.")
	
	const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
	
	return new timeSinceRecursion(seconds, depth + 1, locale).get()
}