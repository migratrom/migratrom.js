import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addEnumValue, applyMigrations, createType } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("addEnumValue integration", () => {
	test("adds enum value and skips on re-apply", async () => {
		const M: Migration = {
			id: 4101,
			parentId: null,
			operations: [
				createType("public", "migratrom_color", ["red", "blue"], dialect),
				addEnumValue("public", "migratrom_color", "green", dialect),
			],
		};

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([4101]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_enum e
				JOIN pg_type t ON t.oid = e.enumtypid
				JOIN pg_namespace n ON n.oid = t.typnamespace
				WHERE n.nspname = 'public' AND t.typname = 'migratrom_color' AND e.enumlabel = 'green'
			)`,
		);
		expect(exists).toBe(true);

		const second = await applyMigrations([M], { dialect, db });
		expect(second.applied).toEqual([]);
	});
});
