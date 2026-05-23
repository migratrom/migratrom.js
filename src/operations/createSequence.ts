import type { Operation } from "../types.ts";
import { regclassExistsSql } from "../sql/catalog.ts";
import { qualified } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Create a standalone sequence in the given schema.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param name - Unqualified sequence name.
 * @returns An idempotent operation that skips when the sequence already exists.
 */
export function createSequence(schema: string, name: string): Operation {
	const createSql = `CREATE SEQUENCE ${qualified(schema, name)}`;

	return {
		id: `sequence.${name}`,
		label: `Create sequence "${name}"`,
		precheck: [
			check(`ensure sequence "${name}" does not exist`, regclassExistsSql(schema, name, true)),
		],
		execute: [step(`create sequence "${name}"`, createSql)],
		postcheck: [check(`verify sequence "${name}" exists`, regclassExistsSql(schema, name, false))],
	};
}
