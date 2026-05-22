import type { Operation } from "../types.ts";
import { enumTypeExistsSql } from "../sql/catalog.ts";
import { qualified, quoteLiteral } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function createType(schema: string, name: string, labels: string[]): Operation {
	const labelList = labels.map((l) => quoteLiteral(l)).join(", ");
	const createSql = `CREATE TYPE ${qualified(schema, name)} AS ENUM (${labelList})`;

	return {
		id: `type.${name}`,
		label: `Create enum type "${name}"`,
		precheck: [
			check(`ensure type "${name}" does not exist`, enumTypeExistsSql(schema, name, true)),
		],
		execute: [step(`create enum type "${name}"`, createSql)],
		postcheck: [check(`verify type "${name}" exists`, enumTypeExistsSql(schema, name, false))],
	};
}
