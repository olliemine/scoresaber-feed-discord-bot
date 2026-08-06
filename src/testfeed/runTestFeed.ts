import { postLevelFeed } from "../feed/levelFeedMessage.js"
import { postPlayerFeed } from "../feed/userFeedMessage.js"
import { MapChannelFeedConfiguration } from "../types/config.js"
import { resolveFeed } from "./feedCatalog.js"
import { buildMapScenario, findPlayerScenario } from "./findScenario.js"

export async function runTestFeed(
	feed: string,
	channelId: string,
	scoreId?: number
) {
	const resolved = resolveFeed(feed)
	const testLabel = `[TEST FEED — ${feed}]`

	if(resolved.kind === "player") {
		if(scoreId != null) {
			throw new Error("Player feeds do not support score_id. Omit it to auto-find players from ScoreSaber.")
		}

		const scenario = await findPlayerScenario(feed)
		await postPlayerFeed(
			resolved.channelConfiguration,
			feed,
			scenario.playerUpdate,
			scenario.snipedUpdate,
			scenario.snipedPlayers,
			scenario.updateProp,
			{ channelIdOverride: channelId, testFeedLabel: testLabel }
		)
		return
	}

	const mapScenario = await buildMapScenario(feed, scoreId)
	await postLevelFeed(
		resolved.channelConfiguration as MapChannelFeedConfiguration,
		feed,
		mapScenario.play,
		mapScenario.map,
		mapScenario.playerA,
		mapScenario.playerB,
		mapScenario.oldPlayerA,
		mapScenario.oldPlayerB,
		{ channelIdOverride: channelId, testFeedLabel: testLabel }
	)
}
