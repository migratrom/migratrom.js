import type Database from "libsql";
import { createTxContext } from "../db/txContext.ts";
import { parseScalarRows, previewRow } from "../db/queryResult.ts";
import { CheckShapeError } from "../errors.ts";
import type { Db } from "../types.ts";

function parseSQLiteBool(rows: unknown[], sql: string): boolean {
	if (rows.length !== 1) {
		throw new CheckShapeError(`check must return exactly one row, got ${rows.length}`, {
			sql,
			rowPreview: previewRow(rows),
		});
	}
	const row = rows[0];
	if (row === null || typeof row !== "object" || Array.isArray(row)) {
		throw new CheckShapeError("row must be an object", {
			sql,
			rowPreview: previewRow(rows),
		});
	}
	const values = Object.values(row as Record<string, unknown>);
	if (values.length !== 1) {
		throw new CheckShapeError(`must return exactly one column, got ${values.length}`, {
			sql,
			rowPreview: previewRow(rows),
		});
	}
	const value = values[0];
	if (typeof value === "boolean") return value;
	if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
	if (typeof value === "bigint" && (value === 0n || value === 1n)) return value === 1n;
	throw new CheckShapeError("check must return a boolean-compatible value", {
		sql,
		rowPreview: previewRow(rows),
	});
}

/**
 * Wrap a local or in-memory `libsql` database as a migratrom {@link Db}.
 *
 * The adapter uses the synchronous `libsql` API behind the core async contract.
 */
export function libsqlAdapter(database: Database.Database): Db {
	const txCtx = createTxContext<boolean>();

	const queryRows = (sql: string): unknown[] => database.prepare(sql).all();

	return {
		async queryBool(sql: string): Promise<boolean> {
			return parseSQLiteBool(queryRows(sql), sql);
		},

		async execute(sql: string): Promise<void> {
			database.exec(sql);
		},

		async queryScalar<T>(sql: string): Promise<T | undefined> {
			const rows = queryRows(sql);
			try {
				return parseScalarRows<T>(rows);
			} catch (error) {
				if (error instanceof CheckShapeError) {
					throw error.withContext({
						sql,
						rowPreview: error.rowPreview ?? previewRow(rows),
					});
				}
				throw error;
			}
		},

		async queryRows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
			return queryRows(sql) as T[];
		},

		async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
			if (txCtx.getActive()) return fn();
			database.exec("BEGIN");
			try {
				const result = await txCtx.run(true, fn);
				database.exec("COMMIT");
				return result;
			} catch (error) {
				try {
					database.exec("ROLLBACK");
				} catch {
					// Preserve the original transaction failure.
				}
				throw error;
			}
		},
	};
}
