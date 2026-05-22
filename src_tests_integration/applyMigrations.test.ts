/**
 * End-to-end apply against a live Postgres instance.
 *
 * These tests document the core promise of migratrom: a migration object is not
 * just a plan on paper — it becomes real DDL and a durable history entry. That
 * path goes through postgresAdapter, so we exercise the same stack production uses.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, addUnique, createTable } from "../src/index.ts";
import { defaultHistoryTable, readAppliedIds } from "../src/runner/history.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const M: Migration = {
	id: 100,
	parentId: null,
	operations: [
		createTable(
			"public",
			"user",
			[
				{ name: "id", typeSql: "SERIAL" },
				{ name: "email", typeSql: "text" },
			],
			{ columns: ["id"] },
		),
		addUnique("public", "user", "user_email_key", ["email"]),
	],
};

describe("applyMigrations integration", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** A pending migration is applied once: schema changes land and the id is remembered. */
	test("applies migration and records history", async () => {
		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([100]);
		expect(result.skippedOps).toEqual([]);

		const appliedIds = await readAppliedIds(db, defaultHistoryTable());
		expect(appliedIds.has(100)).toBe(true);

		const tableExists = await db.queryBool(`SELECT to_regclass('"public"."user"') IS NOT NULL`);
		expect(tableExists).toBe(true);

		const constraintExists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'user_email_key'
				AND conrelid = '"public"."user"'::regclass
			)`,
		);
		expect(constraintExists).toBe(true);
	});

	/**
	 * History is more than a list of ids — it captures the exact operations and a
	 * checksum at apply time, which is what makes post-deploy edits detectable.
	 */
	test("history row has checksum and operations", async () => {
		await applyMigrations([M], { db });
		const rows = await db.queryRows<{
			id: number;
			checksum: string;
			operations: string;
		}>(`SELECT id, checksum, operations FROM "${defaultHistoryTable()}"`);
		expect(rows).toHaveLength(1);
		expect(Number(rows[0]?.id)).toBe(100);
		expect(rows[0]?.checksum.length).toBeGreaterThan(0);
		expect(rows[0]?.operations).toContain("table.user");
	});

	/** applied_at is set at INSERT time and is always a recent timestamp. */
	test("history row has applied_at timestamp within last minute", async () => {
		await applyMigrations([M], { db });
		const rows = await db.queryRows<{ epoch: number | string }>(
			`SELECT EXTRACT(EPOCH FROM applied_at) AS epoch FROM "${defaultHistoryTable()}"`,
		);
		expect(rows).toHaveLength(1);
		const epochSec = Number(rows[0]!.epoch);
		const nowSec = Date.now() / 1000;
		expect(epochSec).toBeGreaterThan(nowSec - 60);
		expect(epochSec).toBeLessThanOrEqual(nowSec + 5);
	});
});

describe("applyMigrations addUnique on multiple columns", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** A multi-column unique constraint names all its columns in the index definition. */
	test("creates multi-column unique constraint with both columns indexed", async () => {
		const migration: Migration = {
			id: 110,
			parentId: null,
			operations: [
				createTable(
					"public",
					"event",
					[
						{ name: "user_id", typeSql: "integer" },
						{ name: "event_type", typeSql: "text" },
					],
					{ columns: ["user_id", "event_type"] },
				),
				addUnique("public", "event", "event_user_type_key", ["user_id", "event_type"]),
			],
		};

		const result = await applyMigrations([migration], { db });
		expect(result.applied).toEqual([110]);

		const cols = await db.queryRows<{ attname: string }>(
			`SELECT a.attname
			 FROM pg_constraint c
			 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
			 WHERE c.conname = 'event_user_type_key'
			 ORDER BY a.attname`,
		);
		expect(cols.map((r) => r.attname).sort()).toEqual(["event_type", "user_id"]);
	});
});

describe("applyMigrations skippedOps", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/**
	 * When a table already exists before the migration runs, the createTable op's
	 * postcheck passes immediately and the op is marked "skipped". The migration
	 * is still recorded in history so it won't be attempted again.
	 */
	test("op skipped when object pre-exists; migration still recorded", async () => {
		await db.execute(`CREATE TABLE public.pre_existing (id SERIAL NOT NULL, PRIMARY KEY (id))`);

		const migration: Migration = {
			id: 120,
			parentId: null,
			operations: [
				createTable("public", "pre_existing", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
			],
		};

		const result = await applyMigrations([migration], { db });
		expect(result.applied).toEqual([120]);
		expect(result.skippedOps).toEqual(["table.pre_existing"]);

		const rows = await db.queryRows<{ id: number | string }>(
			`SELECT id FROM "${defaultHistoryTable()}"`,
		);
		expect(rows).toHaveLength(1);
		expect(Number(rows[0]!.id)).toBe(120);
	});
});

describe("applyMigrations mixed applied and pending", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/**
	 * Passing an already-applied migration alongside a new one is the normal
	 * production pattern: the caller hands the full list and the runner figures
	 * out what still needs doing.
	 */
	test("already-applied migration is skipped; pending migration is applied", async () => {
		const M1: Migration = {
			id: 130,
			parentId: null,
			operations: [
				createTable("public", "alpha", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
			],
		};
		const M2: Migration = {
			id: 131,
			parentId: 130,
			operations: [
				createTable("public", "beta", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
			],
		};

		await applyMigrations([M1], { db });

		const result = await applyMigrations([M1, M2], { db });
		expect(result.applied).toEqual([131]);
		expect(result.skippedOps).toEqual([]);

		const betaExists = await db.queryBool(`SELECT to_regclass('"public"."beta"') IS NOT NULL`);
		expect(betaExists).toBe(true);
	});
});

describe("applyMigrations custom historyTable", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** The history table name is caller-controlled; the default must not be created. */
	test("uses specified table name and does not create default", async () => {
		const migration: Migration = {
			id: 140,
			parentId: null,
			operations: [
				createTable("public", "cfg", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
			],
		};

		const result = await applyMigrations([migration], { db, historyTable: "my_migrations" });
		expect(result.applied).toEqual([140]);

		const customExists = await db.queryBool(`SELECT to_regclass('"my_migrations"') IS NOT NULL`);
		expect(customExists).toBe(true);

		const rows = await db.queryRows<{ id: number | string }>(`SELECT id FROM "my_migrations"`);
		expect(rows).toHaveLength(1);
		expect(Number(rows[0]!.id)).toBe(140);

		const defaultExists = await db.queryBool(
			`SELECT to_regclass('"__migratron_history__"') IS NOT NULL`,
		);
		expect(defaultExists).toBe(false);
	});
});
