import type { Operation } from "../types.ts";
import { alterTable, columnExistsSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function renameColumn(schema: string, table: string, from: string, to: string): Operation {
	const qTable = alterTable(schema, table);
	const alterSql = `ALTER TABLE ${qTable} RENAME COLUMN ${quoteIdent(from)} TO ${quoteIdent(to)}`;

	return {
		id: `rename_column.${table}.${from}_to_${to}`,
		label: `Rename column "${from}" to "${to}" on "${table}"`,
		precheck: [
			check(
				`ensure column "${from}" exists on "${table}"`,
				columnExistsSql(schema, table, from, false),
			),
			check(
				`ensure column "${to}" does not exist on "${table}"`,
				columnExistsSql(schema, table, to, true),
			),
		],
		execute: [step(`rename column "${from}" to "${to}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify column "${to}" exists on "${table}"`,
				columnExistsSql(schema, table, to, false),
			),
		],
	};
}
