import "./setup.ts";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { applyMigrations, createSchema } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("createSchema integration", () => {
	afterEach(async () => {
		await db.execute("DROP SCHEMA IF EXISTS migratrom_app CASCADE");
	});

	test("creates schema and skips on re-apply", async () => {
		const M: Migration = {
			id: 3301,
			parentId: null,
			operations: [createSchema("migratrom_app")],
		};

		expect((await applyMigrations([M], { db })).applied).toEqual([3301]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM information_schema.schemata WHERE schema_name = 'migratrom_app'
			)`,
		);
		expect(exists).toBe(true);

		expect((await applyMigrations([M], { db })).applied).toEqual([]);
	});
});
