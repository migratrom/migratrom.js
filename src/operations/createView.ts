import type { Operation, SQLDialect } from "../types.ts";
import { check, step } from "./helpers.ts";

/**
 * Create a regular (non-materialized) view from a `SELECT` statement.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param name - Unqualified view name.
 * @param selectSql - Query body after `AS`; must not include a trailing semicolon.
 * @returns An idempotent operation that skips when the view already exists.
 */
export function createView(
	schema: string,
	name: string,
	selectSql: string,
	dialect: SQLDialect,
): Operation {
	const createSql = `CREATE VIEW ${dialect.qualified(schema, name)} AS ${selectSql}`;

	return {
		id: `view.${name}`,
		label: `Create view "${name}"`,
		precheck: [
			check(`ensure view "${name}" does not exist`, dialect.viewExistsSql(schema, name, true)),
		],
		execute: [step(`create view "${name}"`, createSql)],
		postcheck: [check(`verify view "${name}" exists`, dialect.viewExistsSql(schema, name, false))],
	};
}
