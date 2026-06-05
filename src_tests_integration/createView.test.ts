import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createTable, createView } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("createView integration", () => {
	test("creates view over table and skips on re-apply", async () => {
		const M: Migration = {
			id: 4201,
			parentId: null,
			operations: [
				createTable("public", "view_src", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
				createView("public", "view_src_ids", "SELECT id FROM public.view_src", dialect),
			],
		};

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([4201]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM information_schema.views
				WHERE table_schema = 'public' AND table_name = 'view_src_ids'
			)`,
		);
		expect(exists).toBe(true);

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([]);
	});
});
