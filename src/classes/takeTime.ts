import { localizationFunction } from "../languages/lang.js"
import { PromiseOrNot } from "../types/util.js"
import TextChanges from "./textChanges.js"

type timeValues = ({
	ended: true,
	label: string,
	dateStart: Date,
	dateEnding: Date,
	timeInSeconds: number
} | {
	ended: false,
	label: string,
	dateStart: Date,
})[]

export default class TakeTime extends TextChanges {
	private timeValues: timeValues = []
	
	constructor(title?: string, localization?: localizationFunction) {
		super(localization)
		if(title) this.addText(title, 0)
	}

	static differenceBetweenDates(date1: Date, date2: Date) {
		return parseFloat(((date2.getTime() - date1.getTime()) / 1000).toFixed(2))
	}

	start(label: string): void
	start(label: string, func: () => PromiseOrNot<any>, level?: number): Promise<any>
	async start(label: string, func?: () => PromiseOrNot<any>, level?: number): Promise<any> {
		const index = this.timeValues.findIndex(t => t.label === label)
		if(index !== -1) throw new Error("Label already started")
		
		this.timeValues.push({
			ended: false,
			label: label,
			dateStart: new Date()
		})

		if(!func) return
		
		const data = await func()

		this.endTime(label, level)

		return data
	}
	

	endTime(label: string, level = 1) {
		const index = this.timeValues.findIndex(t => t.label === label)
		if(index === -1) throw new Error("Label not found")
	
		const timeValue = this.timeValues[index]
	
		if(timeValue.ended === true) return
	
		const dateEnding = new Date()
		const dateStart = timeValue.dateStart

		this.timeValues[index] = {
			ended: true,
			timeInSeconds: TakeTime.differenceBetweenDates(dateStart, dateEnding),
			label: timeValue.label,
			dateStart,
			dateEnding
		}

		const newTimeValue = this.timeValues[index] as Exclude<timeValues[number], { ended: false }>

		this.addText(`${newTimeValue.label}: ${newTimeValue.timeInSeconds.toString()}s`, level)
	}
}