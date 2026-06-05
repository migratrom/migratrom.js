import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

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
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "addPrimaryKeyConstraints", "ADD PRIMARY KEY constraints");
	const qTable = dialect.qualified(schema, table);
	const alterSql = `ALTER TABLE ${qTable} ADD CONSTRAINT ${dialect.quoteIdent(constraintName)} PRIMARY KEY (${dialect.quoteIdentList(columns)})`;

	return {
		id: `pk.${table}.${constraintName}`,
		label: `Add primary key "${constraintName}" on "${table}"`,
		precheck: [
			check(
				`ensure primary key "${constraintName}" does not exist on "${table}"`,
				dialect.constraintExistsSql(schema, table, constraintName, true),
			),
		],
		execute: [step(`add primary key "${constraintName}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify primary key "${constraintName}" exists on "${table}"`,
				dialect.constraintExistsSql(schema, table, constraintName, false),
			),
		],
	};
}
