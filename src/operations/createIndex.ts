import type { CreateIndexOptions, Operation } from "../types.ts";
import { qualified, quoteIdent, quoteIdentList, regclassLiteral } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/**
 * Create a btree index on one or more table columns.
 *
 * When {@link CreateIndexOptions.concurrently} is true, emits
 * `CREATE INDEX CONCURRENTLY` and marks the operation
 * {@link Operation.outsideTransaction | outsideTransaction} so it runs outside
 * the per-migration transaction.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param table - Indexed table.
 * @param indexName - Catalog name for the new index.
 * @param columns - Indexed column(s), in index order.
 * @param options - Pass `{ concurrently: true }` for non-blocking index builds.
 * @returns An idempotent operation that skips when the index already exists.
 */
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
