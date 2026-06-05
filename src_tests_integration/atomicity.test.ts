/**
 * Transaction atomicity tests.
 *
 * A migration's operations and its history record are committed together in a
 * single transaction. If any operation fails, both the schema changes and the
 * history insert must be rolled back — the DB is left as if the migration never
 * ran, and the caller receives a MigrationFailedError wrapping the cause.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createTable, rawSql } from "../src/index.ts";
import { MigrationFailedError } from "../src/errors.ts";
import { defaultHistoryTable } from "../src/runner/history.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("migration atomicity", () => {
	/**
	 * When an operation fails mid-migration, the wrapping transaction rolls back.
	 * Any schema changes from earlier operations in the same migration must be
	 * undone and no history row must exist for that migration id.
	 */
	test("failed migration rolls back schema changes and leaves no history row", async () => {
		const M: Migration = {
			id: 1,
			parentId: null,
			operations: [
				createTable("public", "atomic_tbl", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
				rawSql({
					label: "intentionally failing step",
					execute: [
						{
							sql: `DO $$ BEGIN RAISE EXCEPTION 'intentional failure for atomicity test'; END $$`,
						},
					],
					// Postcheck must return false initially so the op is not skipped before execute runs.
					postcheck: [
						{
							description: "never true sentinel",
							sql: `SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = '__will_never_exist_xyz__')`,
						},
					],
				}),
			],
		};

		await expect(applyMigrations([M], { dialect, db })).rejects.toThrow(MigrationFailedError);

		// Table from the first op must have been rolled back
		const tableExists = await db.queryBool(
			`SELECT to_regclass('"public"."atomic_tbl"') IS NOT NULL`,
		);
		expect(tableExists).toBe(false);

		// History row must not exist
		const rows = await db.queryRows(`SELECT id FROM "${defaultHistoryTable()}"`);
		expect(rows).toHaveLength(0);
	});

	/**
	 * MigrationFailedError carries the migration id and the underlying cause so
	 * that the caller can surface a precise error message.
	 */
	test("MigrationFailedError wraps underlying cause with migrationId", async () => {
		const M: Migration = {
			id: 2,
			parentId: null,
			operations: [
				rawSql({
					label: "raise error with message",
					execute: [
						{
							sql: `DO $$ BEGIN RAISE EXCEPTION 'root cause message here'; END $$`,
						},
					],
					postcheck: [
						{
							sql: `SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = '__will_never_exist_xyz__')`,
						},
					],
				}),
			],
		};

		let thrown: unknown;
		try {
			await applyMigrations([M], { dialect, db });
		} catch (err) {
			thrown = err;
		}

		expect(thrown).toBeInstanceOf(MigrationFailedError);
		const mfe = thrown as MigrationFailedError;
		expect(mfe.migrationId).toBe(2);
		expect(mfe.cause).toBeTruthy();
		expect(String(mfe.cause)).toContain("root cause message here");
	});
});
