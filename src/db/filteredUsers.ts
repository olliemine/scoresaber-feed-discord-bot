import userSchema from "../models/userSchema.js"
import getConfig from "../config/getConfig.js"
import { PipelineStage } from "mongoose"
import { user } from "../types/db.js"

export function matchNonSuspendedUsers()  {
	return {
		$match: {
			category: { $nin: ["InactiveUser", "BannedUser"]}
		}
	}
}

export function matchUsersByCountry(country: string) {
	return {
        $match: {
            $or: [{
				unofficialCountry: {
					$eq: country
				}
			}, {
				$and: [{
					unofficialCountry: {
						$exists: false
					}
				}, {
					scoresaberCountry: {
						$eq: country
					}
				}]
			}]
        }
    }
}

export async function getUsersByCountry(country: string) {
	return await userSchema.aggregate([matchUsersByCountry(country)])
}

export function matchMainCountriesUsers() {
	return {
		$match: {
			$or: [{
				unofficialCountry: {
					$in: getConfig()["main-countries"]
				}
			}, {
				$and: [{
					unofficialCountry: {
						$exists: false
					}
				}, {
					scoresaberCountry: {
						$in: getConfig()["main-countries"]
					}
				}]
			}]
		}
	}
}

export async function getMainCountriesUsers() {
    return await userSchema.aggregate([matchMainCountriesUsers()])
}

export function getRankWindowFieldPipeline(variableLabel: string, order: "ascending" | "descending" = "descending"): PipelineStage {
	return {
		$setWindowFields: {
			sortBy: { [variableLabel]: order === "descending" ? -1 : 1 },
			output: {
				rank: {
					$rank: {}
				}
			}
		}
	}
}

export async function getRank(id: string, variableLabel: string, mapRank: boolean, order?: "ascending" | "descending", matchFilter?: PipelineStage): Promise<number | null>
export async function getRank(dataUser: user, variableLabel: string, mapRank: boolean, order?: "ascending" | "descending", matchFilter?: PipelineStage): Promise<number | null>
export async function getRank(idOrDataUser: user | string, variableLabel: string, mapRank: boolean, order: "ascending" | "descending" = "descending", matchFilter?: PipelineStage): Promise<number | null> {
    let aggregationPipeline: PipelineStage[] = []

	if(mapRank && getConfig().database.suspendedUsersForMapLeaderboards === false) aggregationPipeline.push(matchNonSuspendedUsers())
	else if(mapRank === false && getConfig().database.suspendedUsersForLeaderboards === false) aggregationPipeline.push(matchNonSuspendedUsers())

	if(matchFilter) aggregationPipeline.push(matchFilter)
	
	const res = await userSchema.aggregate([...aggregationPipeline,
		getRankWindowFieldPipeline(variableLabel, order),
	{
		$match: {
			scoresaberID: typeof idOrDataUser === "string" ? idOrDataUser : idOrDataUser.scoresaberID
		}
	}, {
		$project: {
			rank: "$rank"
		}
	}])

	if(!res[0] || res[0].rank == undefined) return null 
    return res[0].rank
}