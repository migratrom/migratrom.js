import type { Operation } from "../types.ts";
import { schemaExistsSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Create a PostgreSQL schema.
 *
 * @param name - Schema name; quoted as a SQL identifier.
 * @returns An idempotent operation that skips when the schema already exists.
 */
export function createSchema(name: string): Operation {
	const createSql = `CREATE SCHEMA ${quoteIdent(name)}`;

	return {
		id: `schema.${name}`,
		label: `Create schema "${name}"`,
		precheck: [check(`ensure schema "${name}" does not exist`, schemaExistsSql(name, true))],
		execute: [step(`create schema "${name}"`, createSql)],
		postcheck: [check(`verify schema "${name}" exists`, schemaExistsSql(name, false))],
	};
}
