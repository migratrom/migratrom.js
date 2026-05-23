import type { Operation } from "../types.ts";
import { regclassExistsSql } from "../sql/catalog.ts";
import { qualified, quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Rename a table within a schema.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param from - Current table name.
 * @param to - New table name; must not already exist in the schema.
 * @returns An idempotent operation that skips when the target name is already present.
 */
export function renameTable(schema: string, from: string, to: string): Operation {
	const alterSql = `ALTER TABLE ${qualified(schema, from)} RENAME TO ${quoteIdent(to)}`;

	return {
		id: `rename_table.${from}_to_${to}`,
		label: `Rename table "${from}" to "${to}"`,
		precheck: [
			check(`ensure table "${from}" exists`, regclassExistsSql(schema, from, false)),
			check(`ensure table "${to}" does not exist`, regclassExistsSql(schema, to, true)),
		],
		execute: [step(`rename table "${from}" to "${to}"`, alterSql)],
		postcheck: [check(`verify table "${to}" exists`, regclassExistsSql(schema, to, false))],
	};
}
