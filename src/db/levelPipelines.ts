import { PipelineStage } from "mongoose"
import levelSchema from "../models/levelSchema.js"

export async function top1CountRate(id: string, country: string | null, ranked: boolean) {
	let aggregationPipeline: PipelineStage[] = ranked === true ? [{
		$match: { isRanked: true }
	}] : []

	if(country) {
		aggregationPipeline.push({
			$project: {
				leaderboard: {
					$filter: {
						input: "$leaderboard",
						as: "player",
						cond: { $eq: ["$$player.country", country] },
						limit: 1
					}
				}
			}
		})
	}

	const counts: { top1Count: number }[] = await levelSchema.aggregate([...aggregationPipeline, {
		$match: { "leaderboard.0.playerID": id }
	}, {
		$count: "top1Count"
	}])
	
	return counts[0]?.top1Count ?? 0
}

export function createScoreCondition(modifiedScore: any, baseScore: any) {
	return {
		$cond: {
			if: { $eq: ["$positiveModifiers", true]},
			then: modifiedScore,
			else: {
				$cond: {
					if: { $lt: ["$leaderboard.score.multiplier", 1]},
					then: modifiedScore,
					else: baseScore
				}
			}
		}
	}
}

export const scoreCondition = createScoreCondition("$leaderboard.score.modifiedScore", "$leaderboard.score.baseScore")