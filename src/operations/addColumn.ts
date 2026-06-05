import type { ColumnDef, Operation, SQLDialect } from "../types.ts";
import { check, step } from "./helpers.ts";

/**
 * Add a column to an existing table.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table receiving the new column.
 * @param col - Column definition; {@link ColumnDef.defaultSql} must include `DEFAULT` when set.
 * @returns An idempotent operation that skips when the column already exists.
 */
export function addColumn(
	schema: string,
	table: string,
	col: ColumnDef,
	dialect: SQLDialect,
): Operation {
	const qTable = dialect.qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD COLUMN ${dialect.renderColumnDef(col)}`;

	return {
		id: `column.${table}.${col.name}`,
		label: `Add column "${col.name}" on "${table}"`,
		precheck: [
			check(
				`ensure column "${col.name}" does not exist on "${table}"`,
				dialect.columnExistsSql(schema, table, col.name, true),
			),
		],
		execute: [step(`add column "${col.name}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${col.name}" exists on "${table}"`,
				dialect.columnExistsSql(schema, table, col.name, false),
			),
		],
	};
}
