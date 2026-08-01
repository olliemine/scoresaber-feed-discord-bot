export default class Buffer<T>  {
	private bufferArray: T[] = []
	private timeoutReference: NodeJS.Timeout | undefined
	private flushBufferFunction: (bufferArray: T[]) => any
	private waitingTime: number
	private pendingFlush: Promise<void> = Promise.resolve()

	constructor(
		flushBufferFunction: (bufferArray: T[]) => any,
		waitingTime = 1000*5
	) {
		this.flushBufferFunction = flushBufferFunction
		this.waitingTime = waitingTime
	}

	flushBuffer() {
		const items = this.bufferArray
		this.bufferArray = []

		this.pendingFlush = this.pendingFlush
			.then(() => this.flushBufferFunction(items))
			.then(() => undefined, () => undefined)
	}

	addBuffer(arg: T) {
		this.bufferArray.push(arg)
		
		if(this.timeoutReference != null) clearTimeout(this.timeoutReference)

		this.timeoutReference = setTimeout(() => {
			this.flushBuffer()
		}, this.waitingTime)
	}
}
