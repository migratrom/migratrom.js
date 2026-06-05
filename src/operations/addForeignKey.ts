import type { ForeignKeySpec, Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Add a named foreign-key constraint referencing another table in the same schema.
 *
 * @param schema - PostgreSQL schema shared by the referencing and referenced tables.
 * @param table - Table that holds the foreign-key column(s).
 * @param spec - Constraint name, local columns, referenced table/columns, and optional referential actions.
 * @returns An idempotent operation that skips when the constraint already exists.
 */
export function addForeignKey(
	schema: string,
	table: string,
	spec: ForeignKeySpec,
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "addForeignKeys", "ADD FOREIGN KEY constraints");
	const qTable = dialect.qualified(schema, table);
	const refTable = dialect.qualified(schema, spec.references.table);
	const parts = [
		`ALTER TABLE ${qTable}`,
		`  ADD CONSTRAINT ${dialect.quoteIdent(spec.name)}`,
		`  FOREIGN KEY (${dialect.quoteIdentList(spec.columns)})`,
		`  REFERENCES ${refTable} (${dialect.quoteIdentList(spec.references.columns)})`,
	];
	if (spec.onDelete) parts.push(`  ON DELETE ${spec.onDelete}`);
	if (spec.onUpdate) parts.push(`  ON UPDATE ${spec.onUpdate}`);
	const alterSql = parts.join("\n");

	return {
		id: `fk.${table}.${spec.name}`,
		label: `Add foreign key "${spec.name}" on "${table}"`,
		precheck: [
			check(
				`ensure foreign key "${spec.name}" does not exist on "${table}"`,
				dialect.constraintExistsSql(schema, table, spec.name, true),
			),
		],
		execute: [step(`add foreign key "${spec.name}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify foreign key "${spec.name}" exists on "${table}"`,
				dialect.constraintExistsSql(schema, table, spec.name, false),
			),
		],
	};
}
