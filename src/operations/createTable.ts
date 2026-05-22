import type { ColumnDef, Operation, PrimaryKey } from "../types.ts";
import { renderColumnList } from "../sql/columns.ts";
import { qualified, quoteIdentList, regclassLiteral } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function createTable(
	schema: string,
	table: string,
	columns: ColumnDef[],
	primaryKey?: PrimaryKey,
): Operation {
	const reg = regclassLiteral(schema, table);
	const lines = [renderColumnList(columns)];
	if (primaryKey) {
		lines.push(`PRIMARY KEY (${quoteIdentList(primaryKey.columns)})`);
	}
	const createSql = `CREATE TABLE ${qualified(schema, table)} (\n  ${lines.join(",\n  ")}\n)`;

	return {
		id: `table.${table}`,
		label: `Create table "${table}"`,
		precheck: [
			check(`ensure table "${table}" does not exist`, `SELECT to_regclass(${reg}) IS NULL`),
		],
		execute: [step(`create table "${table}"`, createSql)],
		postcheck: [check(`verify table "${table}" exists`, `SELECT to_regclass(${reg}) IS NOT NULL`)],
	};
}
