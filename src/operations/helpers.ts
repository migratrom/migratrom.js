import { UnsupportedFeatureError } from "../errors.ts";
import type { Check, ExecuteStep, SQLDialect } from "../types.ts";

export function check(description: string, sql: string): Check {
	return { description, sql };
}

export function step(description: string, sql: string): ExecuteStep {
	return { description, sql };
}

export function requireCapability(
	dialect: SQLDialect,
	capability: keyof SQLDialect["capabilities"],
	feature: string,
): void {
	if (!dialect.capabilities[capability]) {
		throw new UnsupportedFeatureError(feature, dialect.name);
	}
}
