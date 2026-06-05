import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addColumn, applyMigrations, createTable, setColumnDefault } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("setColumnDefault integration", () => {
	test("sets default on nullable column", async () => {
		const M: Migration = {
			id: 3601,
			parentId: null,
			operations: [
				createTable("public", "def_tbl", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
				addColumn(
					"public",
					"def_tbl",
					{ name: "status", typeSql: "text", nullable: true },
					dialect,
				),
				setColumnDefault("public", "def_tbl", "status", "DEFAULT 'open'", dialect),
			],
		};

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([3601]);

		const hasDefault = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'def_tbl'
					AND column_name = 'status' AND column_default IS NOT NULL
			)`,
		);
		expect(hasDefault).toBe(true);

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([]);
	});
});
