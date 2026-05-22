import type { Operation } from "../types.ts";
import { regclassExistsSql } from "../sql/catalog.ts";
import { qualified } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

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
