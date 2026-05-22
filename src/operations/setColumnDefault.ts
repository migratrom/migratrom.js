import type { Operation } from "../types.ts";
import { alterTable, columnDefaultSetSql, columnExistsSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function setColumnDefault(
	schema: string,
	table: string,
	column: string,
	defaultSql: string,
): Operation {
	const qTable = alterTable(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ALTER COLUMN ${quoteIdent(column)} SET ${defaultSql}`;

	return {
		id: `column_default.${table}.${column}`,
		label: `Set default on column "${column}" of "${table}"`,
		precheck: [
			check(
				`ensure column "${column}" exists on "${table}"`,
				columnExistsSql(schema, table, column, false),
			),
			check(
				`ensure column "${column}" has no default yet on "${table}"`,
				columnDefaultSetSql(schema, table, column, true),
			),
		],
		execute: [step(`set default on column "${column}" of "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${column}" has a default on "${table}"`,
				columnDefaultSetSql(schema, table, column, false),
			),
		],
	};
}
