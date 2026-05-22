import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createSequence } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("createSequence integration", () => {
	test("creates sequence and skips on re-apply", async () => {
		const M: Migration = {
			id: 3501,
			parentId: null,
			operations: [createSequence("public", "migratrom_seq")],
		};

		expect((await applyMigrations([M], { db })).applied).toEqual([3501]);

		const exists = await db.queryBool(`SELECT to_regclass('"public"."migratrom_seq"') IS NOT NULL`);
		expect(exists).toBe(true);

		const second = await applyMigrations([M], { db });
		expect(second.applied).toEqual([]);
	});
});
