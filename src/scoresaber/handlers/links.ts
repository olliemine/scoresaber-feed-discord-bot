import { scoresaberAPI } from "../../constants.js"

export const getNameFindString = (name: string) => new URL(`${scoresaberAPI}/players?search=${name}`)
export const getIDFullFindString = (id: string) => new URL(`${scoresaberAPI}/players/${id}`)
export const getIDBasicFindString = (id: string) => new URL(`${scoresaberAPI}/players/${id}/basic`)

export const getScorePageString = (id: string, limit: string, page: string) => new URL(`${scoresaberAPI}/players/${id}/scores?limit=${limit.toString()}&sort=recent&page=${page.toString()}&personalBest=true`)

export const getCountryPage = (page: string, country: string) => new URL(`${scoresaberAPI}/players?page=${page}&countries=${country}`)

export const getRankedMapsPage = (page: number, limit: number, minStars?: number, maxStars?: number) => new URL(
	`${scoresaberAPI}/maps?status=RANKED&page=${page}&limit=${limit}` +
	(minStars != null ? `&minStars=${minStars}` : "") +
	(maxStars != null ? `&maxStars=${maxStars}` : "")
)