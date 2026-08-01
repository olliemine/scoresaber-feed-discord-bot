import { UPDATE_STATUS } from "../types/util.js"
import { languageString } from "../languages/lang.js"

export const UPDATE_STATUS_LANGUAGE: {[key in UPDATE_STATUS]: languageString} = {
	[UPDATE_STATUS.SUCCESS]: "updateSuccess",
	[UPDATE_STATUS.NO_UPDATE]: "updateNoUpdate",
	[UPDATE_STATUS.ERROR]: "updateError",
	[UPDATE_STATUS.PARTIAL_SUCCESS]: "updatePartialSuccess"
}
