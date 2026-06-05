import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createTable, renameTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("renameTable integration", () => {
	test("renames table and skips on re-apply", async () => {
		const M: Migration = {
			id: 3901,
			parentId: null,
			operations: [
				createTable("public", "ren_from", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
				renameTable("public", "ren_from", "ren_to", dialect),
			],
		};

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([3901]);

		const exists = await db.queryBool(`SELECT to_regclass('"public"."ren_to"') IS NOT NULL`);
		expect(exists).toBe(true);

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([]);
	});
});
