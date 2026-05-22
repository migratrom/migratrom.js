import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addPrimaryKey, applyMigrations, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("addPrimaryKey integration", () => {
	test("adds primary key to table without inline PK", async () => {
		const M: Migration = {
			id: 3201,
			parentId: null,
			operations: [
				createTable("public", "pk_tbl", [{ name: "id", typeSql: "SERIAL" }]),
				addPrimaryKey("public", "pk_tbl", "pk_tbl_pkey", ["id"]),
			],
		};

		expect((await applyMigrations([M], { db })).applied).toEqual([3201]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'pk_tbl_pkey' AND contype = 'p' AND conrelid = '"public"."pk_tbl"'::regclass
			)`,
		);
		expect(exists).toBe(true);

		expect((await applyMigrations([M], { db })).applied).toEqual([]);
	});
});
