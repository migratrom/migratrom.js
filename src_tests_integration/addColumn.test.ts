import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addColumn, applyMigrations, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("addColumn integration", () => {
	test("applies columns on follow-up migration", async () => {
		const M1: Migration = {
			id: 3001,
			parentId: null,
			operations: [
				createTable("public", "user", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
			],
		};
		const M2: Migration = {
			id: 3002,
			parentId: 3001,
			operations: [
				addColumn("public", "user", { name: "email", typeSql: "text" }, dialect),
				addColumn(
					"public",
					"user",
					{
						name: "role",
						typeSql: "text",
						defaultSql: "DEFAULT 'user'",
					},
					dialect,
				),
			],
		};

		expect((await applyMigrations([M1, M2], { dialect, db })).applied).toEqual([3001, 3002]);

		const emailExists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'email'
			)`,
		);
		expect(emailExists).toBe(true);
	});

	test("second apply is a no-op", async () => {
		const M1: Migration = {
			id: 3003,
			parentId: null,
			operations: [
				createTable("public", "col_user", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
			],
		};
		const M2: Migration = {
			id: 3004,
			parentId: 3003,
			operations: [
				addColumn("public", "col_user", { name: "note", typeSql: "text", nullable: true }, dialect),
			],
		};

		await applyMigrations([M1, M2], { dialect, db });
		const second = await applyMigrations([M1, M2], { dialect, db });
		expect(second.applied).toEqual([]);
	});

	test("custom schema", async () => {
		await db.execute("CREATE SCHEMA IF NOT EXISTS app");
		try {
			const M: Migration = {
				id: 3005,
				parentId: null,
				operations: [
					createTable("app", "widget", [{ name: "id", typeSql: "SERIAL" }], dialect, {
						columns: ["id"],
					}),
					addColumn("app", "widget", { name: "label", typeSql: "text", nullable: true }, dialect),
				],
			};
			await applyMigrations([M], { dialect, db });
			const exists = await db.queryBool(
				`SELECT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_schema = 'app' AND table_name = 'widget' AND column_name = 'label'
				)`,
			);
			expect(exists).toBe(true);
		} finally {
			await db.execute("DROP SCHEMA IF EXISTS app CASCADE");
		}
	});
});
