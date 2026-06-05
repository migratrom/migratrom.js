/**
 * applyMigrations is designed for repeated invocation — deploy scripts, local dev,
 * CI — without double-applying work. History is the source of truth for what is
 * already done; a migration that has been recorded should be invisible on the
 * next run.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const M: Migration = {
	id: 200,
	parentId: null,
	operations: [
		createTable("public", "item", [{ name: "id", typeSql: "SERIAL" }], dialect, {
			columns: ["id"],
		}),
	],
};

describe("applyMigrations idempotency", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** Running the same migration again after a successful apply changes nothing. */
	test("second apply is a no-op", async () => {
		const first = await applyMigrations([M], { dialect, db });
		expect(first.applied).toEqual([200]);

		const second = await applyMigrations([M], { dialect, db });
		expect(second.applied).toEqual([]);
		expect(second.skippedOps).toEqual([]);

		const exists = await db.queryBool(`SELECT to_regclass('"public"."item"') IS NOT NULL`);
		expect(exists).toBe(true);
	});
});
