import type { Operation } from "../types.ts";
import { matviewExistsSql } from "../sql/catalog.ts";
import { qualified } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function createMaterializedView(schema: string, name: string, selectSql: string): Operation {
	const createSql = `CREATE MATERIALIZED VIEW ${qualified(schema, name)} AS ${selectSql}`;

	return {
		id: `matview.${name}`,
		label: `Create materialized view "${name}"`,
		precheck: [
			check(
				`ensure materialized view "${name}" does not exist`,
				matviewExistsSql(schema, name, true),
			),
		],
		execute: [step(`create materialized view "${name}"`, createSql)],
		postcheck: [
			check(`verify materialized view "${name}" exists`, matviewExistsSql(schema, name, false)),
		],
	};
}
