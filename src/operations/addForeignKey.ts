import type { ForeignKeySpec, Operation } from "../types.ts";
import { constraintExistsSql } from "../sql/catalog.ts";
import { qualified, quoteIdent, quoteIdentList } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Add a named foreign-key constraint referencing another table in the same schema.
 *
 * @param schema - PostgreSQL schema shared by the referencing and referenced tables.
 * @param table - Table that holds the foreign-key column(s).
 * @param spec - Constraint name, local columns, referenced table/columns, and optional referential actions.
 * @returns An idempotent operation that skips when the constraint already exists.
 */
export function addForeignKey(schema: string, table: string, spec: ForeignKeySpec): Operation {
	const qTable = qualified(schema, table);
	const refTable = qualified(schema, spec.references.table);
	const parts = [
		`ALTER TABLE ${qTable}`,
		`  ADD CONSTRAINT ${quoteIdent(spec.name)}`,
		`  FOREIGN KEY (${quoteIdentList(spec.columns)})`,
		`  REFERENCES ${refTable} (${quoteIdentList(spec.references.columns)})`,
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
				constraintExistsSql(schema, table, spec.name, true),
			),
		],
		execute: [step(`add foreign key "${spec.name}" on "${table}"`, alterSql)],
		postcheck: [
			check(
				`verify foreign key "${spec.name}" exists on "${table}"`,
				constraintExistsSql(schema, table, spec.name, false),
			),
		],
	};
}
