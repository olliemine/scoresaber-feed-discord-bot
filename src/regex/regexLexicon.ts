import { embedDecodeFunction } from "../discord/message/regexHandler.js"
import { allIndexesOf, isObjectEmpty } from "../misc/util.js"
import { RegexMessage } from "../types/config.js"

export interface regexLexiconIf {
	indexStartIfStatement: number,
	indexLastIfStatement: number,
	indexStartWord: number,
	indexLastWord: number,
	ifStatement: string
}

export interface regexLexicon {
	enabled: {
		replace: string,
		startIndex: number,
		lastIndex: number
	}[],
	every: string[],
	ifs: regexLexiconIf[]
}

function sortRegexLexicon(regexLexicon: regexLexicon) {
	regexLexicon.enabled.sort((a, b) => a.startIndex - b.startIndex)
	regexLexicon.ifs.sort((a, b) => a.indexStartIfStatement - b.indexStartIfStatement)
	return regexLexicon
}

function ifStatementLoop(string: string, startIndex: number): regexLexiconIf | null {
	const whiteSpaceRegex = /\s/
	
	let temp = {
		indexStartIfStatement: startIndex,
		indexLastIfStatement: -1,
		indexStartWord: -1,
		indexLastWord: -1,
		ifStatement: ""
	}

	if(string[startIndex] !== "[") return null
	let depth = 0

	string = string.replace(/(?:\r\n|\r|\n)/g, "j");

	for (let i = startIndex; i < string.length; i++) {
		const letter = string[i];
		if(letter === "[") {
			depth++
			continue
		}

		if(letter === "]") {
			depth--
		}

		if(depth === 0) {
			if(whiteSpaceRegex.test(string[i + 1])) {
				depth++
				continue
			}

			temp.indexLastIfStatement = i
			temp.indexStartWord = i + 1
			break
		}
	}

	if(temp.indexLastIfStatement === -1) return null

	for(let i = temp.indexStartWord; i < string.length; i++) {
		const letter = string[i];
		
		if(whiteSpaceRegex.test(letter)) {
			temp.indexLastWord = i - 1
			temp.ifStatement = string.slice(temp.indexStartWord, temp.indexLastWord + 1)
			break
		}
	}

	if(temp.indexLastWord === -1) {
		temp.indexLastWord = string.length - 1
		temp.ifStatement = string.slice(temp.indexStartWord, temp.indexLastWord + 1)
	}

	return temp
}

export function getRegexLexicon(
	regexExec: string,
	simpleRegexs: string[],
	complexRegexs: RegExp[],
	{ ifs = false, every = false, unique = false }): { regexLexicon: regexLexicon, every: string[] } {	

	let regexLexicon: regexLexicon = {enabled: [], ifs: [], every: []}
	let everyLexicon: string[] = []

	function checkStringsIndividual(r: string | null, regex: RegExp) {
		let i

		while (i = regex.exec(regexExec)) {
			const replaceWord = r || i[0].slice(1, -1)
			regexLexicon.enabled.push({ replace: replaceWord, startIndex: i.index, lastIndex: regex.lastIndex })
			
			if(unique && regexLexicon.every.includes(replaceWord)) {
				throw new Error(`${replaceWord} string cant have both of the same regexes.`)
			}

			if(unique || every) regexLexicon.every.push(replaceWord.split("_")[0])
			if(every) everyLexicon.push(replaceWord.split("_")[0])
		}
	}

	simpleRegexs.forEach(r => {
		const regex = new RegExp(`{${r}}`, "g")
		checkStringsIndividual(r, regex)
	})

	complexRegexs.forEach(r => {
		checkStringsIndividual(null, r)
	})
	
	if(!ifs) return {
		regexLexicon: sortRegexLexicon(regexLexicon),
		every: everyLexicon
	}

	const ifStatements = allIndexesOf(regexExec, "[")
		.map(index => ifStatementLoop(regexExec, index))
		.filter(data => data != null) as regexLexiconIf[]

	regexLexicon.ifs = ifStatements
	
	return {
		regexLexicon: sortRegexLexicon(regexLexicon),
		every: everyLexicon
	}
}

export function getRegexLexicons(
	regexExecs: {data: string, key: string}[],
	simpleRegexs: string[],
	complexRegexs: RegExp[],
	{ ifs = false, every = false, unique = false }): { regexLexicon: {[k: string]: regexLexicon}, every: string[] } {
	
	let regexLexicon: {[k: string]: regexLexicon} = {}
	let everyLexicon: string[] = []

	regexExecs.forEach(regexExec => {
		const { regexLexicon: regexLexiconFunction, every: everyFunction } = getRegexLexicon(regexExec.data, simpleRegexs, complexRegexs, { ifs, every, unique })
		
		if(regexLexiconFunction) regexLexicon[regexExec.key] = sortRegexLexicon(regexLexiconFunction)
		everyLexicon = everyLexicon.concat(everyFunction)
	})
	
	return {
		regexLexicon: regexLexicon,
		every: everyLexicon
	}
}

export function checkRegexOfMessage(
	message: RegexMessage,
	key: string,
	simpleRegexs: string[],
	complexRegexs: RegExp[],
{ ifs = false, every = false, unique = false}): {
	regexLexicon: regexLexicon,
	every: string[],
	isEmbed: false
} | {
	regexLexicon: { [key: string]: regexLexicon },
	every: string[],
	isEmbed: true
} {
	let data
	
	if(message.type === "message") {
		data = getRegexLexicon(message.message, simpleRegexs, complexRegexs, { ifs, every, unique })
		return {
			regexLexicon: data.regexLexicon,
			every: data.every,
			isEmbed: false
		}
	}

	if(isObjectEmpty(message)) throw new Error(`Incorrect type of message At (${key})`)

	let joinedText = 0
	if(message.embedTitle) joinedText += message.embedTitle.length
	if(message.embedDescription) joinedText += message.embedDescription.length

	if(message.embedFields) {
		Object.values(message.embedFields).forEach((embedField) => {
			if(embedField[0]) joinedText += embedField[0].length
			if(embedField[1]) joinedText += embedField[1].length
		})
	}

	if(joinedText > 5950) throw new Error(`The sum of all embed characters exceded the length cap (5950) At (${key})`)

	let regexExecs = []

	if(message.embedTitle) {
		regexExecs.push({key: "embedTitle", data: message.embedTitle})
	}
	if(message.embedDescription) {
		regexExecs.push({key: "embedDescription", data: message.embedDescription})
	}
	if(message.embedFields) {
		for (let i = 1; i < Object.keys(message.embedFields).length + 1; i++) {
			regexExecs.push({key: `embedFields_${i}_0`, data: message.embedFields[i][0]})
			regexExecs.push({key: `embedFields_${i}_1`, data: message.embedFields[i][1]})
		}
	}

	data = getRegexLexicons(regexExecs, simpleRegexs, complexRegexs, { ifs, every, unique })

	return {
		regexLexicon: data.regexLexicon,
		every: data.every,
		isEmbed: true
	}
}

export async function decodeStringAsync(
	str: string,
	regexLexicon: regexLexicon,
	stringToDecodedFunction: embedDecodeFunction,
	argumentsForDecodedFunction: any,
	{ removeSlashOption = false }
): Promise<string>
{

	if(!regexLexicon) return str
	
	let temp = str
	let removeSlash: number[] = []

	const removeSlashCheck = (startIndex: number) => removeSlashOption && startIndex !== 0 && temp.charAt(startIndex - 1) === "/" 
	const removeSlashLengthChanged = (startIndex: number, lengthchanged: number) => removeSlash.forEach((f) => f < startIndex ? null : f += lengthchanged)
	
	let ifs: regexLexiconIf[] = JSON.parse(JSON.stringify(regexLexicon.ifs))

	if(regexLexicon.enabled.length) {
		for (let i = regexLexicon.enabled.length - 1 ; i >= 0 ; i--) {
			const r = regexLexicon.enabled[i]
			if(removeSlashCheck(r.startIndex)) {
				removeSlash.push(r.startIndex - 1)
				continue
			}
			let replazer = await stringToDecodedFunction(r.replace, argumentsForDecodedFunction)
			if(replazer == null) replazer = ""
			temp = temp.slice(0, r.startIndex) + replazer + temp.slice(r.lastIndex)
			
			if(!regexLexicon.ifs.length) continue
			
			const lengthchanged = replazer.toString().length - (r.replace.length + 2)

			ifs.forEach(f => {
				if(f.indexStartIfStatement > r.startIndex) { 
					f.indexStartIfStatement += lengthchanged
				}
				
				if(f.indexLastIfStatement > r.startIndex) {
					f.indexLastIfStatement += lengthchanged
					f.indexStartWord += lengthchanged
					f.indexLastWord += lengthchanged
				}
			})

			removeSlashLengthChanged(r.startIndex, lengthchanged)
		}
	}

	if(regexLexicon.ifs.length) {
		for (let i = ifs.length - 1; i >= 0 ; i--) {
			const f = ifs[i]
			if(removeSlashCheck(f.indexStartIfStatement)) {
				removeSlash.push(f.indexStartIfStatement - 1)
				continue
			}
			const oldLength = temp.length
			const string = await stringToDecodedFunction(f.ifStatement, argumentsForDecodedFunction)
			const isDefined = !!string
			if(isDefined) temp = temp.slice(0, f.indexStartIfStatement) + temp.slice(f.indexStartIfStatement + 1, f.indexLastIfStatement) + temp.slice(f.indexLastWord + 1)
			else temp = temp.slice(0, f.indexStartIfStatement) + temp.slice(f.indexLastWord + 1)
			
			const lengthchanged = temp.length - oldLength
			removeSlashLengthChanged(f.indexStartIfStatement, lengthchanged)
		}
	}

	if(removeSlashOption) removeSlash.forEach(pos => temp = temp.slice(0, pos) + temp.slice(pos + 1))
	return temp.trim().length === 0 ? "." : temp
}