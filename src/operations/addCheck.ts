import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Add a named `CHECK` constraint to a table.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table to alter.
 * @param constraintName - Stable constraint name stored in the catalog.
 * @param checkSql - Boolean expression inside the constraint, without surrounding parentheses.
 * @returns An idempotent operation that skips when the constraint already exists.
 */
export function addCheck(
	schema: string,
	table: string,
	constraintName: string,
	checkSql: string,
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "addCheckConstraints", "ADD CHECK constraints");
	const qTable = dialect.qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD CONSTRAINT ${dialect.quoteIdent(constraintName)} CHECK (${checkSql})`;

	return {
		id: `check.${table}.${constraintName}`,
		label: `Add check constraint "${constraintName}" on "${table}"`,
		precheck: [
			check(
				`ensure check constraint "${constraintName}" does not exist on "${table}"`,
				dialect.checkConstraintExistsSql(schema, table, constraintName, true),
			),
		],
		execute: [step(`add check constraint "${constraintName}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify check constraint "${constraintName}" exists on "${table}"`,
				dialect.checkConstraintExistsSql(schema, table, constraintName, false),
			),
		],
	};
}
