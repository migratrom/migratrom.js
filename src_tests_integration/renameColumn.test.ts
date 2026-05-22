import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createTable, renameColumn } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("renameColumn integration", () => {
	test("renames column and skips on re-apply", async () => {
		const M: Migration = {
			id: 3801,
			parentId: null,
			operations: [
				createTable(
					"public",
					"ren_col",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "old_name", typeSql: "text", nullable: true },
					],
					{ columns: ["id"] },
				),
				renameColumn("public", "ren_col", "old_name", "new_name"),
			],
		};

		expect((await applyMigrations([M], { db })).applied).toEqual([3801]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'ren_col' AND column_name = 'new_name'
			)`,
		);
		expect(exists).toBe(true);

		expect((await applyMigrations([M], { db })).applied).toEqual([]);
	});
});
