import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import Database from "libsql";
import { libsqlAdapter } from "../src/adapters/sqlite.ts";
import {
	addColumn,
	applyMigrations,
	createIndex,
	createTable,
	createView,
	rawSql,
	renameColumn,
	renameTable,
	SQLiteDialect,
} from "../src/index.ts";
import { MigrationChecksumMismatchError, MigrationFailedError } from "../src/errors.ts";
import type { Migration } from "../src/types.ts";

const paths: string[] = [];

afterEach(() => {
	for (const path of paths.splice(0)) {
		rmSync(path, { force: true });
		rmSync(`${path}-shm`, { force: true });
		rmSync(`${path}-wal`, { force: true });
	}
});

function connect(name: string) {
	const path = join("/tmp", `migratrom-${name}-${crypto.randomUUID()}.sqlite`);
	paths.push(path);
	const database = new Database(path);
	return { database, db: libsqlAdapter(database) };
}

describe("SQLite migration application", () => {
	test("applies, records, verifies, and idempotently reapplies an on-disk migration", async () => {
		const { database, db } = connect("apply");
		const dialect = new SQLiteDialect();
		const migration: Migration = {
			id: 1,
			parentId: null,
			operations: [
				createTable(
					"main",
					"users",
					[
						{ name: "id", typeSql: "INTEGER" },
						{ name: "email", typeSql: "TEXT" },
					],
					dialect,
					{ columns: ["id"] },
				),
				addColumn("main", "users", { name: "name", typeSql: "TEXT", nullable: true }, dialect),
				createIndex("main", "users", "users_email_idx", ["email"], dialect),
				createView("main", "user_emails", 'SELECT "email" FROM "main"."users"', dialect),
				renameColumn("main", "users", "name", "display_name", dialect),
				renameTable("main", "users", "accounts", dialect),
			],
		};

		expect((await applyMigrations([migration], { db, dialect })).applied).toEqual([1]);
		expect((await applyMigrations([migration], { db, dialect })).applied).toEqual([]);
		expect(
			await db.queryBool(
				"SELECT EXISTS (SELECT 1 FROM main.sqlite_master WHERE type = 'table' AND name = 'accounts')",
			),
		).toBe(true);
		expect(
			await db.queryBool(
				"SELECT EXISTS (SELECT 1 FROM pragma_table_info('accounts') WHERE name = 'display_name')",
			),
		).toBe(true);
		expect(
			await db.queryBool(
				"SELECT EXISTS (SELECT 1 FROM main.sqlite_master WHERE type = 'index' AND name = 'users_email_idx')",
			),
		).toBe(true);
		const history = await db.queryRows<{ checksum: string; operations: string }>(
			'SELECT checksum, operations FROM "__migratron_history__"',
		);
		expect(history[0]?.checksum).toMatch(/^sha256\/[0-9a-f]{64}$/);
		expect(history[0]?.operations).toMatch(/^[0-9a-f]+$/);
		database.close();
	});

	test("detects checksum drift", async () => {
		const { database, db } = connect("checksum");
		const dialect = new SQLiteDialect();
		const migration: Migration = {
			id: 1,
			parentId: null,
			operations: [createTable("main", "items", [{ name: "id", typeSql: "INTEGER" }], dialect)],
		};
		await applyMigrations([migration], { db, dialect });
		await expect(
			applyMigrations([{ ...migration, operations: [] }], { db, dialect }),
		).rejects.toThrow(MigrationChecksumMismatchError);
		database.close();
	});

	test("dry-run and failed migrations leave no schema or history row", async () => {
		const { database, db } = connect("atomic");
		const dialect = new SQLiteDialect();
		const dryRun: Migration = {
			id: 1,
			parentId: null,
			operations: [createTable("main", "dry_items", [{ name: "id", typeSql: "INTEGER" }], dialect)],
		};
		expect((await applyMigrations([dryRun], { db, dialect, dryRun: true })).applied).toEqual([]);
		expect(
			await db.queryBool(
				"SELECT NOT EXISTS (SELECT 1 FROM main.sqlite_master WHERE name = 'dry_items')",
			),
		).toBe(true);

		const failing: Migration = {
			id: 2,
			parentId: null,
			operations: [
				createTable("main", "atomic_items", [{ name: "id", typeSql: "INTEGER" }], dialect),
				rawSql({
					id: "fail",
					label: "fail",
					execute: [{ sql: "THIS IS NOT SQL" }],
					postcheck: [{ sql: "SELECT 0" }],
				}),
			],
		};
		await expect(applyMigrations([failing], { db, dialect })).rejects.toThrow(MigrationFailedError);
		expect(
			await db.queryBool(
				"SELECT NOT EXISTS (SELECT 1 FROM main.sqlite_master WHERE name = 'atomic_items')",
			),
		).toBe(true);
		expect(await db.queryScalar<number>('SELECT count(*) FROM "__migratron_history__"')).toBe(0);
		database.close();
	});
});
