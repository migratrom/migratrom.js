import type { Check, ExecuteStep, Operation } from "../types.ts";
import { ConfigError } from "../errors.ts";

export interface RawSqlInput {
	label: string;
	precheck?: Array<Partial<Check> & { sql: string }>;
	execute: Array<Partial<ExecuteStep> & { sql: string }>;
	postcheck?: Array<Partial<Check> & { sql: string }>;
	id?: string;
}

function slugify(label: string): string {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ".")
		.replace(/^\.+|\.+$/g, "");
}

function normalizeChecks(checks: Array<Partial<Check> & { sql: string }> | undefined): Check[] {
	if (!checks) return [];
	return checks.map((c) => ({
		description: c.description ?? c.sql,
		sql: c.sql,
	}));
}

function normalizeSteps(steps: Array<Partial<ExecuteStep> & { sql: string }>): ExecuteStep[] {
	return steps.map((s) => ({
		description: s.description ?? s.sql,
		sql: s.sql,
	}));
}

export function rawSql(input: RawSqlInput): Operation {
	const execute = normalizeSteps(input.execute);
	if (execute.length === 0) {
		throw new ConfigError("rawSql requires at least one execute step");
	}

	const postcheck = normalizeChecks(input.postcheck);
	if (postcheck.length === 0) {
		throw new ConfigError("rawSql requires at least one postcheck step");
	}

	return {
		id: input.id ?? slugify(input.label),
		label: input.label,
		precheck: normalizeChecks(input.precheck),
		execute,
		postcheck,
	};
}
