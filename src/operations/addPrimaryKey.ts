import type { Operation } from "../types.ts";
import { alterTable, constraintExistsSql } from "../sql/catalog.ts";
import { quoteIdent, quoteIdentList } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Add a named `PRIMARY KEY` constraint on existing columns.
 *
 * Use {@link createTable} when defining the primary key at table creation time.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Table to alter.
 * @param constraintName - Stable constraint name stored in the catalog.
 * @param columns - Primary-key column(s), in key order.
 * @returns An idempotent operation that skips when the constraint already exists.
 */
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
