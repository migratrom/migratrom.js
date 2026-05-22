import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addCheck, applyMigrations, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("addCheck integration", () => {
	test("applies check constraint and skips on re-apply", async () => {
		const M: Migration = {
			id: 3101,
			parentId: null,
			operations: [
				createTable("public", "amounts", [{ name: "n", typeSql: "integer" }]),
				addCheck("public", "amounts", "amounts_n_positive", "n > 0"),
			],
		};

		expect((await applyMigrations([M], { db })).applied).toEqual([3101]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'amounts_n_positive' AND conrelid = '"public"."amounts"'::regclass
			)`,
		);
		expect(exists).toBe(true);

		const second = await applyMigrations([M], { db });
		expect(second.applied).toEqual([]);
	});
});
