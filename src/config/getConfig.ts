import AjvImport from "ajv"
import { AnyObject } from "mongoose"
import configType from "../types/config.js"
import chalk from "chalk"
import fs from "fs"

// ajv types are not constructable under moduleResolution node16
const Ajv = AjvImport as unknown as {
	new (options?: object): {
		compile(schema: object): ((data: unknown) => boolean) & { errors: unknown }
	}
}

function fatalLog(a: any) {
	console.log(a)
	return process.abort()
}

function generateEmptyObjects(obj: AnyObject, schema: AnyObject, definitions: AnyObject) {
	if(schema.$ref) {
		const ref = schema.$ref.split("/")
		schema = definitions[ref[ref.length - 1]]
	}

	if(schema.type !== "object" || !schema.properties || (
		schema.required && schema.required.length === Object.keys(schema.properties).length
	)) return

	Object.keys(schema.properties).forEach(prop => {				
		const propObj = generateEmptyObjects(obj[prop] ?? {}, schema.properties[prop], definitions)

		if(!propObj) return

		obj[prop.toString()] = propObj
	})

	return obj
}

let validadedConfig: configType | undefined = undefined

export default function getConfig(): configType {
	if(validadedConfig !== undefined) return validadedConfig
	
	const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))

	const schema = JSON.parse(fs.readFileSync("./schema.json", "utf-8"))

	if(!config || !schema) return fatalLog("Config file missing")

	let usedConfig = config

	const testMode = config.testMode ? true : false

	if(config.testMode === true) {
		const testConfig = JSON.parse(fs.readFileSync("./testconfig.json", "utf-8"))
		
		if(!testConfig || !schema) return fatalLog("Config file missing")

		console.log("Starting in test mode!")

		usedConfig = testConfig
	}

	let c = generateEmptyObjects(usedConfig, schema, schema.definitions)

	if(!c) process.abort()

	const ajv = new Ajv({ removeAdditional: true, useDefaults: true, strict: false, allErrors: true })
	const validate = ajv.compile(schema)
	validate(c)
	
	if(validate.errors) {
		console.log(`${chalk.bgRedBright("CONFIG VALIDATION ERRORS")}: ${validate.errors}`)
		process.abort()
	}

	validadedConfig = c as configType

	validadedConfig.testMode = testMode

	return c as configType
}