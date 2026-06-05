import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Create a materialized view from a `SELECT` statement.
 *
 * Does not refresh the view; use {@link rawSql} or follow-up migrations for
 * `REFRESH MATERIALIZED VIEW` when needed.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param name - Unqualified materialized view name.
 * @param selectSql - Query body after `AS`; must not include a trailing semicolon.
 * @returns An idempotent operation that skips when the materialized view already exists.
 */
export function createMaterializedView(
	schema: string,
	name: string,
	selectSql: string,
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "materializedViews", "materialized views");
	const createSql = `CREATE MATERIALIZED VIEW ${dialect.qualified(schema, name)} AS ${selectSql}`;

	return {
		id: `matview.${name}`,
		label: `Create materialized view "${name}"`,
		precheck: [
			check(
				`ensure materialized view "${name}" does not exist`,
				dialect.matviewExistsSql(schema, name, true),
			),
		],
		execute: [step(`create materialized view "${name}"`, createSql)],
		postcheck: [
			check(
				`verify materialized view "${name}" exists`,
				dialect.matviewExistsSql(schema, name, false),
			),
		],
	};
}
