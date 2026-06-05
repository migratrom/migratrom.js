import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Create a PostgreSQL schema.
 *
 * @param name - Schema name; quoted as a SQL identifier.
 * @returns An idempotent operation that skips when the schema already exists.
 */
export function createSchema(name: string, dialect: SQLDialect): Operation {
	requireCapability(dialect, "schemas", "schemas");
	const createSql = `CREATE SCHEMA ${dialect.quoteIdent(name)}`;

	return {
		id: `schema.${name}`,
		label: `Create schema "${name}"`,
		precheck: [
			check(`ensure schema "${name}" does not exist`, dialect.schemaExistsSql(name, true)),
		],
		execute: [step(`create schema "${name}"`, createSql)],
		postcheck: [check(`verify schema "${name}" exists`, dialect.schemaExistsSql(name, false))],
	};
}
