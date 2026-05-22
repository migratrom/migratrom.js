import type { CreateIndexOptions, Operation } from "../types.ts";
import { qualified, quoteIdent, quoteIdentList, regclassLiteral } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export function createIndex(
	schema: string,
	table: string,
	indexName: string,
	columns: string[],
	options?: CreateIndexOptions,
): Operation {
	const concurrently = options?.concurrently ?? false;
	const reg = regclassLiteral(schema, indexName);
	const concurrentlySql = concurrently ? " CONCURRENTLY" : "";
	const createSql = `CREATE INDEX${concurrentlySql} ${quoteIdent(indexName)} ON ${qualified(schema, table)} (${quoteIdentList(columns)})`;
	const labelSuffix = concurrently ? " concurrently" : "";

	return {
		id: `index.${table}.${indexName}`,
		label: `Create index${labelSuffix} "${indexName}" on "${table}"`,
		precheck: [
			check(`ensure index "${indexName}" does not exist`, `SELECT to_regclass(${reg}) IS NULL`),
		],
		execute: [step(`create index${labelSuffix} "${indexName}" on "${table}"`, createSql)],
		postcheck: [
			check(`verify index "${indexName}" exists`, `SELECT to_regclass(${reg}) IS NOT NULL`),
		],
		...(concurrently ? { outsideTransaction: true } : {}),
	};
}
