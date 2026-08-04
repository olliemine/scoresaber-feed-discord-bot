const MAX_TYPOS = 1
const SHORT_TITLE_WORDS = 2
const LENIENT_TITLE_WORDS = 6
const PREFIX_TITLE_WORDS = 5
const SIGNIFICANT_WORD_LENGTH = 3
const CONSECUTIVE_MATCH_RATIO = 0.8
const LENIENT_MATCH_RATIO = 0.25

const CHARACTER_MAP: { [key: string]: string } = {
	"я": "r", "р": "r", "а": "a", "е": "e", "т": "t", "о": "o", "и": "n", "н": "h",
	"с": "s", "в": "b", "к": "k", "м": "m", "д": "a", "п": "n", "у": "y", "л": "n",
	"б": "6", "ь": "b", "ы": "bl", "з": "3", "х": "x", "ж": "x", "ч": "y", "ш": "w",
	"щ": "w", "ц": "u", "ф": "o", "г": "r", "ё": "e", "ю": "yu", "э": "e", "ъ": "b",
	"á": "a", "à": "a", "â": "a", "ä": "a", "ã": "a", "å": "a", "ā": "a",
	"é": "e", "è": "e", "ê": "e", "ë": "e", "ē": "e",
	"í": "i", "ì": "i", "î": "i", "ï": "i", "ī": "i",
	"ó": "o", "ò": "o", "ô": "o", "ö": "o", "õ": "o", "ō": "o",
	"ú": "u", "ù": "u", "û": "u", "ü": "u", "ū": "u",
	"ý": "y", "ÿ": "y", "ñ": "n", "ç": "c", "ß": "b", "æ": "ae", "œ": "oe",
	"ø": "o", "đ": "d", "ł": "l"
}

function levenshteinDistance(first: string, second: string): number {
	const previous = new Array(second.length + 1).fill(0).map((_, index) => index)

	for(let i = 1; i <= first.length; i++) {
		let diagonal = previous[0]
		previous[0] = i

		for(let j = 1; j <= second.length; j++) {
			const current = previous[j]

			previous[j] = first[i - 1] === second[j - 1]
				? diagonal
				: 1 + Math.min(previous[j], previous[j - 1], diagonal)

			diagonal = current
		}
	}

	return previous[second.length]
}

function withinTypos(first: string, second: string): boolean {
	if(Math.abs(first.length - second.length) > MAX_TYPOS) return false
	return levenshteinDistance(first, second) <= MAX_TYPOS
}

function stripSpaces(str: string): string {
	return str.replace(/\s+/g, "")
}

function clean(str: string): string {
	return str.toLowerCase().replace(/[^\w\s]/g, "").trim()
}

function transliterate(str: string): string {
	return clean(str.toLowerCase().replace(/./g, character => CHARACTER_MAP[character] ?? character))
}

function contains(haystack: string, needle: string): boolean {
	return haystack.includes(needle) || stripSpaces(haystack).includes(stripSpaces(needle))
}

function requiredMatches(titleWords: string[], significantWords: string[]): number {
	if(titleWords.length <= SHORT_TITLE_WORDS) return significantWords.length
	if(titleWords.length <= LENIENT_TITLE_WORDS) return Math.min(2, significantWords.length)

	const lenient = Math.max(2, Math.ceil(significantWords.length * LENIENT_MATCH_RATIO))

	return Math.min(lenient, significantWords.length)
}

function consecutiveMatches(guessWords: string[], significantWords: string[]): number {
	const limit = Math.min(guessWords.length, significantWords.length)
	let matches = 0

	while(matches < limit && withinTypos(guessWords[matches], significantWords[matches])) matches++

	return matches
}

function matchesVariant(guess: string, title: string, author: string): boolean {
	const bareTitle = title.replace(/\([^)]*\)/g, "").trim()

	if(contains(guess, author) && contains(guess, bareTitle)) return true
	if(withinTypos(stripSpaces(guess), stripSpaces(bareTitle))) return true

	const titleWords = bareTitle.split(" ").filter(Boolean)
	const guessWords = guess.split(" ").filter(Boolean)

	if(!guessWords.length) return false
	if(titleWords.length <= 1) return withinTypos(guess, bareTitle)

	const significantWords = titleWords.length <= SHORT_TITLE_WORDS
		? titleWords
		: titleWords.filter(word => word.length > SIGNIFICANT_WORD_LENGTH)

	const matched = guessWords.filter(word => significantWords.some(significant => withinTypos(word, significant))).length

	if(matched >= requiredMatches(titleWords, significantWords)) return true
	if(titleWords.length < PREFIX_TITLE_WORDS) return false
	if(guessWords.length >= 2 && bareTitle.startsWith(guess)) return true

	return consecutiveMatches(guessWords, significantWords) >= Math.ceil(guessWords.length * CONSECUTIVE_MATCH_RATIO)
}

export function checkGuess(guess: string, songName: string, songAuthor: string): boolean {
	return matchesVariant(clean(guess), clean(songName), clean(songAuthor)) ||
		matchesVariant(transliterate(guess), transliterate(songName), transliterate(songAuthor))
}
