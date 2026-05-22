import type { Operation } from "../types.ts";
import { alterTable, constraintExistsSql } from "../sql/catalog.ts";
import { quoteIdent, quoteIdentList } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function addPrimaryKey(
	schema: string,
	table: string,
	constraintName: string,
	columns: string[],
): Operation {
	const qTable = alterTable(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD CONSTRAINT ${quoteIdent(constraintName)} PRIMARY KEY (${quoteIdentList(columns)})`;

	return {
		id: `pk.${table}.${constraintName}`,
		label: `Add primary key "${constraintName}" on "${table}"`,
		precheck: [
			check(
				`ensure primary key "${constraintName}" does not exist on "${table}"`,
				constraintExistsSql(schema, table, constraintName, true),
			),
		],
		execute: [step(`add primary key "${constraintName}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify primary key "${constraintName}" exists on "${table}"`,
				constraintExistsSql(schema, table, constraintName, false),
			),
		],
	};
}
