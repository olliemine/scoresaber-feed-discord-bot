import fs from "fs"
import { logger } from "../logger.js";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Path = "visitors"
type Content<T extends Path> = T extends "visitors" ? { ids: string[] } : unknown 

class PathResolve {
	path: Path
	localPath: string

	constructor(path: Path) {
		this.path = path
		this.localPath = this.getPath()
	}
	
	private getPath(): string {
		switch(this.path) {
			case "visitors":
				return path.join(__dirname, "../../data/visitors.json")
		}
	}
}

export function getJSON<T extends Path>(path: T): Promise<Content<T>> {
	return new Promise(async (resolve, reject) => {
		const pathResolve = new PathResolve(path)
			
		fs.readFile(pathResolve.localPath, "utf-8", (err, data) => {
			if(err) {
				if(err.stack) logger.error(err.stack)
				return reject(err)
			}
	
			const parsedData = JSON.parse(data)
			return resolve(parsedData)
		})
	})
}

export function writeJSON<T extends Path>(path: T, data: Content<T>): Promise<void> {
	return new Promise((resolve, reject) => {
		const { localPath } = new PathResolve(path)

		fs.writeFile(localPath, JSON.stringify(data), "utf-8", (err) => {
			if(err) {
				if(err.stack) logger.error(err.stack)
				return reject(err)
			}

			resolve()
		})
	})
}