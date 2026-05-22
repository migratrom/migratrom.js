import type { Check, ExecuteStep } from "../types.ts";

export function check(description: string, sql: string): Check {
	return { description, sql };
}

export function step(description: string, sql: string): ExecuteStep {
	return { description, sql };
}
