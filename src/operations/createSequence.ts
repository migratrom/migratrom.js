import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Create a standalone sequence in the given schema.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param name - Unqualified sequence name.
 * @returns An idempotent operation that skips when the sequence already exists.
 */
export function createSequence(schema: string, name: string, dialect: SQLDialect): Operation {
	requireCapability(dialect, "sequences", "sequences");
	const createSql = `CREATE SEQUENCE ${dialect.qualified(schema, name)}`;

	return {
		id: `sequence.${name}`,
		label: `Create sequence "${name}"`,
		precheck: [
			check(`ensure sequence "${name}" does not exist`, dialect.tableExistsSql(schema, name, true)),
		],
		execute: [step(`create sequence "${name}"`, createSql)],
		postcheck: [
			check(`verify sequence "${name}" exists`, dialect.tableExistsSql(schema, name, false)),
		],
	};
}
