import type { Check, ExecuteStep, Operation } from "../types.ts";
import { ConfigError } from "../errors.ts";

/** Input for {@link rawSql}. */
export interface RawSqlInput {
	/** Human-readable label used in logs and as the default operation id slug. */
	label: string;
	/** Optional boolean probes run before execute; descriptions default to the SQL text. */
	precheck?: Array<Partial<Check> & { sql: string }>;
	/** One or more side-effecting statements; at least one is required. */
	execute: Array<Partial<ExecuteStep> & { sql: string }>;
	/** Boolean probes that must pass after execute; at least one is required. */
	postcheck?: Array<Partial<Check> & { sql: string }>;
	/** Stable operation id; defaults to a slug derived from {@link RawSqlInput.label}. */
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

/**
 * Escape hatch for DDL (or DML) not covered by a first-class operation builder.
 *
 * Uses the same precheck → execute → postcheck pipeline as built-in operations.
 * When every postcheck already passes, the operation is skipped. At least one
 * execute step and one postcheck are required.
 *
 * @param input - Label, SQL steps, and optional stable id.
 * @returns A fully specified {@link Operation} ready for a {@link Migration}.
 *
 * @example
 * ```ts
 * rawSql({
 *   label: "create sequence raw_seq",
 *   execute: [{ sql: 'CREATE SEQUENCE public.raw_seq' }],
 *   postcheck: [
 *     { sql: `SELECT to_regclass('"public"."raw_seq"') IS NOT NULL` },
 *   ],
 * })
 * ```
 */
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
