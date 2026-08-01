import { logger } from "../logger.js"
import { wait } from "../misc/util.js"
import { PromiseOrNot } from "../types/util.js"

class QueueElement<T, Q extends any[]> {
	private queueFunction: (...params: Q) => PromiseOrNot<T>
	private elements: Q[]
	private results: T[] | Error = []
	private executingPromise: Promise<void> | undefined

	public finished: boolean = false
	public isExecuting: boolean = false

	constructor(queueFunction: (...params: Q) => PromiseOrNot<T>, elements: Q[]) {
		this.queueFunction = queueFunction
		this.elements = elements
	}

	getResults(): Promise<T[]> {
		if(this.finished) {
			if(this.results instanceof Error) return Promise.reject(this.results)
			return Promise.resolve(this.results)
		}

		return new Promise(async (resolve, reject) => {
			const checkCondition = () => {
				if(!this.finished) {
					setTimeout(checkCondition, 1000)
					return
				}
				
				if(this.results instanceof Error) return reject(this.results)
				return resolve(this.results)
			}

			checkCondition()
		})
	}

	execute(): Promise<void> {
		if(this.finished) throw new Error(`QueueElement is already finished`)
		if(this.isExecuting && this.executingPromise) return this.executingPromise

		this.isExecuting = true

		this.executingPromise = new Promise(async (resolve, reject) => {
			try {
				const results: T[] = []
				
				for await(const args of this.elements) {
					const res = await this.queueFunction(...args)
					results.push(res)
				}
			
				this.isExecuting = false
				this.finished = true
				this.results = results
				resolve()
			} catch(err) {
				this.isExecuting = false
				this.finished = true
				
				if(!(err instanceof Error)) return reject(new Error("Error is not error" + err))
				
				this.results = err
				reject(err)
			}
		})
		
		return this.executingPromise
	}
}

export type ExtractQueueFunctionParams<T> = T extends Queue<any, infer V> ? V : never

export default class Queue<T, Q extends any[]> {
	private queueFunction: (...params: Q) => PromiseOrNot<T>
	private queueElements: QueueElement<T, Q>[] = []
	private pauseDepth: number = 0
	private isExecuting: boolean = false

	constructor(queueFunction: (...params: Q) => PromiseOrNot<T>) {
		this.queueFunction = queueFunction
	}

	continueQueue() {
		if(this.pauseDepth > 0) this.pauseDepth--
		if(this.pauseDepth === 0 && !this.isExecuting && this.queueElements.length > 0) {
			this.executeQueueElement()
		}
		return this
	}

	stopQueue() {
		this.pauseDepth++
		return this
	}

	async getElement(
		element: Q,
		/**
		 * If true, puts them at the beginning of the queue
		 */
		priority?: boolean
	): Promise<T> {	
		const res = await this.getQueueElement(new QueueElement(this.queueFunction, [element]), priority)
		return res[0]
	}

	getElements(
		elements: Q[],
		/**
		 * If true, puts them at the beginning of the queue
		 */
		priority?: boolean
	): Promise<T[]> {	
		return this.getQueueElement(new QueueElement(this.queueFunction, elements), priority)
	}

	private getQueueElement(queueElement: QueueElement<T, Q>, priority = false): Promise<T[]> {
		if(priority === true) {
			this.queueElements = [queueElement, ...this.queueElements]
		} else {
			this.queueElements.push(queueElement)
		}

		if(!this.isExecuting) this.executeQueueElement()

		return queueElement.getResults()
	}

	private async executeQueueElement() {
		if(this.isExecuting) return

		this.isExecuting = true

		try {
			while(this.queueElements.length > 0) {
				while(this.pauseDepth > 0) {
					await wait(50)
				}

				const element = this.queueElements.shift()
				if(!element) break

				await element.execute().catch((err) => logger.unknownError(err))
			}
		} finally {
			this.isExecuting = false
		}
	}
}