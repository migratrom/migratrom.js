import type { ColumnDef, Operation, PrimaryKey } from "../types.ts";
import { renderColumnList } from "../sql/columns.ts";
import { qualified, quoteIdentList, regclassLiteral } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Create a table with the given columns and an optional inline primary key.
 *
 * Columns default to `NOT NULL` unless {@link ColumnDef.nullable} is true.
 * {@link ColumnDef.defaultSql} must include the `DEFAULT` keyword, e.g.
 * `"DEFAULT (now())"`.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Unqualified table name.
 * @param columns - Column definitions; {@link ColumnDef.typeSql} is emitted verbatim.
 * @param primaryKey - Optional composite primary key on existing column names.
 * @returns An idempotent operation with existence pre/post checks.
 */
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
