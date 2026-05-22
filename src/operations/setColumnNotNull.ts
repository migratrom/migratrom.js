import type { Operation } from "../types.ts";
import { alterTable, columnExistsSql, columnNotNullSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function setColumnNotNull(schema: string, table: string, column: string): Operation {
	const qTable = alterTable(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ALTER COLUMN ${quoteIdent(column)} SET NOT NULL`;

	return {
		id: `column_not_null.${table}.${column}`,
		label: `Set NOT NULL on column "${column}" of "${table}"`,
		precheck: [
			check(
				`ensure column "${column}" exists on "${table}"`,
				columnExistsSql(schema, table, column, false),
			),
			check(
				`ensure column "${column}" is nullable on "${table}"`,
				columnNotNullSql(schema, table, column, true),
			),
		],
		execute: [step(`set NOT NULL on column "${column}" of "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${column}" is NOT NULL on "${table}"`,
				columnNotNullSql(schema, table, column, false),
			),
		],
	};
}
