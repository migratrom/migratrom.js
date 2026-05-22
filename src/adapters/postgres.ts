import postgres from "postgres";
import { parseCheckRows, parseScalarRows, previewRow } from "../db/queryResult.ts";
import { createTxContext } from "../db/txContext.ts";
import { CheckShapeError } from "../errors.ts";
import type { Db } from "../types.ts";

type SqlExec = Pick<postgres.Sql, "unsafe">;

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

export function postgresAdapter(sql: postgres.Sql): Db {
	const txCtx = createTxContext<SqlExec>();
	const resolve = (): SqlExec => txCtx.getActive() ?? sql;

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
			const result = await sql.begin(async (tx) => txCtx.run(tx, fn));
			return result as T;
		},
	};
}
