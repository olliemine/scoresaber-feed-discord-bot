import TakeTime from "../classes/takeTime.js";
import TextChanges from "../classes/textChanges.js";

export enum UPDATE_STATUS {
	NO_UPDATE,
	SUCCESS,
	PARTIAL_SUCCESS,
	ERROR,
}

export interface UPDATE_RESULT {
	result: UPDATE_STATUS,
	status?: TextChanges | TakeTime,
}

export enum COMMAND_PERMISSIONS {
	BASE,
	ADMIN,
	MASTER
}

export type PromiseOrNot<type> = Promise<type> | type