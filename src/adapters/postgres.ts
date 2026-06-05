import postgres from "postgres";
import { parseCheckRows, parseScalarRows, previewRow } from "../db/queryResult.ts";
import { createTxContext } from "../db/txContext.ts";
import { CheckShapeError } from "../errors.ts";
import type { Db } from "../types.ts";

type SqlExec = Pick<postgres.Sql, "unsafe">;
type SqlConnection = Pick<postgres.ReservedSql, "unsafe" | "release">;

function parseCheckFromRows(rows: unknown[], sql: string): boolean {
	try {
		return parseCheckRows(rows);
	} catch (err) {
		if (err instanceof CheckShapeError) {
			throw err.withContext({ sql, rowPreview: err.rowPreview ?? previewRow(rows) });
		}
		throw err;
	}
}

function parseScalarFromRows<T>(rows: unknown[], sql: string): T | undefined {
	try {
		return parseScalarRows<T>(rows);
	} catch (err) {
		if (err instanceof CheckShapeError) {
			throw err.withContext({ sql, rowPreview: err.rowPreview ?? previewRow(rows) });
		}
		throw err;
	}
}

/**
 * Wrap a `postgres` client as a {@link Db} for use with {@link applyMigrations}.
 *
 * Reuses the active transaction when {@link Db.withTransaction} is nested, so
 * migration runners and operation executors share one connection scope.
 *
 * @param sql - Connected `postgres` instance (from the `postgres` package).
 * @returns A driver adapter implementing the migratrom {@link Db} contract.
 */
export function postgresAdapter(sql: postgres.Sql): Db {
	const txCtx = createTxContext<SqlExec>();
	const connectionCtx = createTxContext<SqlConnection>();
	const resolve = (): SqlExec => txCtx.getActive() ?? connectionCtx.getActive() ?? sql;

	return {
		async queryBool(rawSql: string): Promise<boolean> {
			const rows = await resolve().unsafe(rawSql);
			return parseCheckFromRows(rows as unknown[], rawSql);
		},

		async execute(rawSql: string): Promise<void> {
			await resolve().unsafe(rawSql);
		},

		async queryScalar<T>(rawSql: string): Promise<T | undefined> {
			const rows = await resolve().unsafe(rawSql);
			return parseScalarFromRows<T>(rows as unknown[], rawSql);
		},

		async queryRows<T extends Record<string, unknown>>(rawSql: string): Promise<T[]> {
			const rows = await resolve().unsafe(rawSql);
			return rows as unknown as T[];
		},

		async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
			if (txCtx.getActive()) return fn();
			const connection = connectionCtx.getActive();
			if (!connection) {
				const result = await sql.begin(async (tx) => txCtx.run(tx, fn));
				return result as T;
			}

			await connection.unsafe("BEGIN");
			try {
				const result = await txCtx.run(connection, fn);
				await connection.unsafe("COMMIT");
				return result;
			} catch (error) {
				try {
					await connection.unsafe("ROLLBACK");
				} catch {
					// Preserve the original transaction failure.
				}
				throw error;
			}
		},

		async withConnection<T>(fn: () => Promise<T>): Promise<T> {
			if (connectionCtx.getActive()) return fn();
			const connection = await sql.reserve();
			try {
				return await connectionCtx.run(connection, fn);
			} finally {
				connection.release();
			}
		},
	};
}
