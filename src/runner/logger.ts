import type { Logger } from "../types.ts";

export const consoleLogger: Logger = {
	info: (msg, meta) => console.log(msg, meta),
	warn: (msg, meta) => console.warn(msg, meta),
	error: (msg, meta) => console.error(msg, meta),
};
