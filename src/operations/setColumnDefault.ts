import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Set a default expression on an existing column.
 *
 * The column must exist and must not already have a default. Pass the full
 * clause including `DEFAULT`, e.g. `"DEFAULT (now())"` or `"DEFAULT 'pending'"`.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table containing the column.
 * @param column - Column to alter.
 * @param defaultSql - Complete `SET` clause fragment after `ALTER COLUMN ...`, starting with `DEFAULT`.
 * @returns An idempotent operation that skips when the default is already set.
 */
export function setColumnDefault(
	schema: string,
	table: string,
	column: string,
	defaultSql: string,
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "alterColumnDefault", "ALTER COLUMN SET DEFAULT");
	const qTable = dialect.qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ALTER COLUMN ${dialect.quoteIdent(column)} SET ${defaultSql}`;

	return {
		id: `column_default.${table}.${column}`,
		label: `Set default on column "${column}" of "${table}"`,
		precheck: [
			check(
				`ensure column "${column}" exists on "${table}"`,
				dialect.columnExistsSql(schema, table, column, false),
			),
			check(
				`ensure column "${column}" has no default yet on "${table}"`,
				dialect.columnDefaultSetSql(schema, table, column, true),
			),
		],
		execute: [step(`set default on column "${column}" of "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${column}" has a default on "${table}"`,
				dialect.columnDefaultSetSql(schema, table, column, false),
			),
		],
	};
}
