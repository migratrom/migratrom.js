/**
 * dryRun integration tests.
 *
 * dryRun:true is the "what would happen?" mode: prechecks and postchecks are
 * evaluated against the live DB, but DDL is never executed and history is never
 * written. The schema must be identical before and after a dry-run call.
 *
 * Two paths exist in applyMigrations:
 *   - Transactional migration:  ops run inside a single transaction that is
 *     intentionally rolled back via DryRunRollback.
 *   - outsideTransaction migration: each transactional batch is flushed and
 *     rolled back, then outsideTransaction ops run through runOperation in
 *     dryRun mode (no execute).
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createIndex, createTable } from "../src/index.ts";
import { defaultHistoryTable } from "../src/runner/history.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("dryRun: transactional migration", () => {
	/**
	 * A dry-run of a pending migration returns applied:[] and leaves the schema
	 * and history table untouched.
	 */
	test("schema unchanged, no history row, applied empty", async () => {
		const M: Migration = {
			id: 1,
			parentId: null,
			operations: [
				createTable("public", "dryrun_tbl", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
			],
		};

		const result = await applyMigrations([M], { dialect, db, dryRun: true });

		expect(result.applied).toEqual([]);
		expect(result.skippedOps).toEqual([]);

		const tableExists = await db.queryBool(
			`SELECT to_regclass('"public"."dryrun_tbl"') IS NOT NULL`,
		);
		expect(tableExists).toBe(false);

		// ensureHistoryTable always creates the TABLE, but no row should be inserted
		const historyRows = await db.queryRows(`SELECT id FROM "${defaultHistoryTable()}"`);
		expect(historyRows).toHaveLength(0);
	});

	/**
	 * After a dry-run, the migration is still "pending" and a subsequent real
	 * apply must succeed as if the dry-run never happened.
	 */
	test("subsequent real apply after dryRun still applies successfully", async () => {
		const M: Migration = {
			id: 2,
			parentId: null,
			operations: [
				createTable("public", "dryrun_real", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
			],
		};

		await applyMigrations([M], { dialect, db, dryRun: true });

		const result = await applyMigrations([M], { dialect, db });
		expect(result.applied).toEqual([2]);

		const exists = await db.queryBool(`SELECT to_regclass('"public"."dryrun_real"') IS NOT NULL`);
		expect(exists).toBe(true);
	});
});

describe("dryRun: outsideTransaction migration", () => {
	/**
	 * A migration containing a CONCURRENTLY index triggers the segmented-tx path.
	 * In dry-run mode the transactional ops are rolled back and the outside op is
	 * evaluated but never executed — both table and index must remain absent.
	 */
	test("schema unchanged and no history row for migration with outsideTransaction op", async () => {
		const M: Migration = {
			id: 3,
			parentId: null,
			operations: [
				createTable(
					"public",
					"dryrun_outer",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "val", typeSql: "text" },
					],
					dialect,
					{ columns: ["id"] },
				),
				createIndex("public", "dryrun_outer", "dryrun_outer_val_idx", ["val"], dialect, {
					concurrently: true,
				}),
			],
		};

		const result = await applyMigrations([M], { dialect, db, dryRun: true });

		expect(result.applied).toEqual([]);

		const tableExists = await db.queryBool(
			`SELECT to_regclass('"public"."dryrun_outer"') IS NOT NULL`,
		);
		expect(tableExists).toBe(false);

		const indexExists = await db.queryBool(
			`SELECT to_regclass('"public"."dryrun_outer_val_idx"') IS NOT NULL`,
		);
		expect(indexExists).toBe(false);

		const historyRows = await db.queryRows(`SELECT id FROM "${defaultHistoryTable()}"`);
		expect(historyRows).toHaveLength(0);
	});
});
