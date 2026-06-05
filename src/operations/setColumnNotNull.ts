import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Promote a nullable column to `NOT NULL`.
 *
 * The column must exist and currently allow nulls. Ensure existing rows satisfy
 * the constraint before applying this migration.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table containing the column.
 * @param column - Column to alter.
 * @returns An idempotent operation that skips when the column is already `NOT NULL`.
 */
export function setColumnNotNull(
	schema: string,
	table: string,
	column: string,
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "alterColumnNotNull", "ALTER COLUMN SET NOT NULL");
	const qTable = dialect.qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ALTER COLUMN ${dialect.quoteIdent(column)} SET NOT NULL`;

	return {
		id: `column_not_null.${table}.${column}`,
		label: `Set NOT NULL on column "${column}" of "${table}"`,
		precheck: [
			check(
				`ensure column "${column}" exists on "${table}"`,
				dialect.columnExistsSql(schema, table, column, false),
			),
			check(
				`ensure column "${column}" is nullable on "${table}"`,
				dialect.columnNotNullSql(schema, table, column, true),
			),
		],
		execute: [step(`set NOT NULL on column "${column}" of "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${column}" is NOT NULL on "${table}"`,
				dialect.columnNotNullSql(schema, table, column, false),
			),
		],
	};
}
