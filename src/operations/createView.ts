import type { Operation } from "../types.ts";
import { viewExistsSql } from "../sql/catalog.ts";
import { qualified } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function createView(schema: string, name: string, selectSql: string): Operation {
	const createSql = `CREATE VIEW ${qualified(schema, name)} AS ${selectSql}`;

	return {
		id: `view.${name}`,
		label: `Create view "${name}"`,
		precheck: [check(`ensure view "${name}" does not exist`, viewExistsSql(schema, name, true))],
		execute: [step(`create view "${name}"`, createSql)],
		postcheck: [check(`verify view "${name}" exists`, viewExistsSql(schema, name, false))],
	};
}
