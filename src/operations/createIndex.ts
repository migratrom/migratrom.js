import type { CreateIndexOptions, Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

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
	dialect: SQLDialect,
	options?: CreateIndexOptions,
): Operation {
	const concurrently = options?.concurrently ?? false;
	if (concurrently) {
		requireCapability(dialect, "concurrentIndexes", "CREATE INDEX CONCURRENTLY");
	}
	const createSql = dialect.createIndexSql(schema, table, indexName, columns, concurrently);
	const labelSuffix = concurrently ? " concurrently" : "";

	return {
		id: `index.${table}.${indexName}`,
		label: `Create index${labelSuffix} "${indexName}" on "${table}"`,
		precheck: [
			check(
				`ensure index "${indexName}" does not exist`,
				dialect.tableExistsSql(schema, indexName, true),
			),
		],
		execute: [step(`create index${labelSuffix} "${indexName}" on "${table}"`, createSql)],
		postcheck: [
			check(`verify index "${indexName}" exists`, dialect.tableExistsSql(schema, indexName, false)),
		],
		...(concurrently ? { outsideTransaction: true } : {}),
	};
}
