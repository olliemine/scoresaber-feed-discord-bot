import mongoose from "mongoose"
import { logger } from "./logger.js"
import getConfig from "./config/getConfig.js"

export default async () => {
	mongoose.set("strictQuery", true)
	
	const uri = getConfig().testMode === true ? process.env["MONGODB_URI_TESTING"] : process.env["MONGODB_URI"] 
	
	if(uri == null) return logger.fatal("MONGODB_URI not found")

	try {
		mongoose.connect(uri)
		return mongoose
	} catch(err) {
		logger.fatal(err as string)
	}
}