import type { Operation } from "../types.ts";
import { constraintExistsSql } from "../sql/catalog.ts";
import { qualified, quoteIdent, quoteIdentList } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function addUnique(
	schema: string,
	table: string,
	constraintName: string,
	columns: string[],
): Operation {
	const qTable = qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD CONSTRAINT ${quoteIdent(constraintName)} UNIQUE (${quoteIdentList(columns)})`;

	return {
		id: `unique.${table}.${constraintName}`,
		label: `Add unique constraint "${constraintName}" on "${table}"`,
		precheck: [
			check(
				`ensure unique constraint "${constraintName}" does not exist on "${table}"`,
				constraintExistsSql(schema, table, constraintName, true),
			),
		],
		execute: [step(`add unique constraint "${constraintName}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify unique constraint "${constraintName}" exists on "${table}"`,
				constraintExistsSql(schema, table, constraintName, false),
			),
		],
	};
}
