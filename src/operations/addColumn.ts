import type { ColumnDef, Operation } from "../types.ts";
import { alterTable, columnExistsSql } from "../sql/catalog.ts";
import { renderColumnDef } from "../sql/columns.ts";
import { check, step } from "./helpers.ts";

/**
 * Add a column to an existing table.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table receiving the new column.
 * @param col - Column definition; {@link ColumnDef.defaultSql} must include `DEFAULT` when set.
 * @returns An idempotent operation that skips when the column already exists.
 */
export function addColumn(schema: string, table: string, col: ColumnDef): Operation {
	const qTable = alterTable(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD COLUMN ${renderColumnDef(col)}`;

	return {
		id: `column.${table}.${col.name}`,
		label: `Add column "${col.name}" on "${table}"`,
		precheck: [
			check(
				`ensure column "${col.name}" does not exist on "${table}"`,
				columnExistsSql(schema, table, col.name, true),
			),
		],
		execute: [step(`add column "${col.name}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${col.name}" exists on "${table}"`,
				columnExistsSql(schema, table, col.name, false),
			),
		],
	};
}
