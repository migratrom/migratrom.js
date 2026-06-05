import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Add a named `UNIQUE` constraint on one or more columns.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table to alter.
 * @param constraintName - Stable constraint name stored in the catalog.
 * @param columns - Column(s) that must be unique together.
 * @returns An idempotent operation that skips when the constraint already exists.
 */
export function addUnique(
	schema: string,
	table: string,
	constraintName: string,
	columns: string[],
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "addUniqueConstraints", "ADD UNIQUE constraints");
	const qTable = dialect.qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD CONSTRAINT ${dialect.quoteIdent(constraintName)} UNIQUE (${dialect.quoteIdentList(columns)})`;

	return {
		id: `unique.${table}.${constraintName}`,
		label: `Add unique constraint "${constraintName}" on "${table}"`,
		precheck: [
			check(
				`ensure unique constraint "${constraintName}" does not exist on "${table}"`,
				dialect.constraintExistsSql(schema, table, constraintName, true),
			),
		],
		execute: [step(`add unique constraint "${constraintName}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify unique constraint "${constraintName}" exists on "${table}"`,
				dialect.constraintExistsSql(schema, table, constraintName, false),
			),
		],
	};
}
