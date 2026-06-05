import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addColumn, applyMigrations, createTable, createType } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("createType integration", () => {
	test("creates enum and uses it in addColumn", async () => {
		const M: Migration = {
			id: 4001,
			parentId: null,
			operations: [
				createType("public", "migratrom_status", ["active", "inactive"], dialect),
				createTable("public", "enum_tbl", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
				addColumn(
					"public",
					"enum_tbl",
					{
						name: "status",
						typeSql: "migratrom_status",
						defaultSql: "DEFAULT 'active'",
					},
					dialect,
				),
			],
		};

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([4001]);

		const typeExists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_type t
				JOIN pg_namespace n ON n.oid = t.typnamespace
				WHERE n.nspname = 'public' AND t.typname = 'migratrom_status' AND t.typtype = 'e'
			)`,
		);
		expect(typeExists).toBe(true);

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([]);
	});
});
