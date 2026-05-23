import type { Operation } from "../types.ts";
import { alterTable, checkConstraintExistsSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

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
): Operation {
	const qTable = alterTable(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD CONSTRAINT ${quoteIdent(constraintName)} CHECK (${checkSql})`;

	return {
		id: `check.${table}.${constraintName}`,
		label: `Add check constraint "${constraintName}" on "${table}"`,
		precheck: [
			check(
				`ensure check constraint "${constraintName}" does not exist on "${table}"`,
				checkConstraintExistsSql(schema, table, constraintName, true),
			),
		],
		execute: [step(`add check constraint "${constraintName}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify check constraint "${constraintName}" exists on "${table}"`,
				checkConstraintExistsSql(schema, table, constraintName, false),
			),
		],
	};
}
