import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { addColumn, applyMigrations, createTable, setColumnNotNull } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("setColumnNotNull integration", () => {
	test("sets NOT NULL on nullable column with data", async () => {
		const M: Migration = {
			id: 3701,
			parentId: null,
			operations: [
				createTable("public", "nn_tbl", [{ name: "id", typeSql: "SERIAL" }], { columns: ["id"] }),
				addColumn("public", "nn_tbl", { name: "code", typeSql: "text", nullable: true }),
				setColumnNotNull("public", "nn_tbl", "code"),
			],
		};

		expect((await applyMigrations([M], { db })).applied).toEqual([3701]);

		const notNull = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'nn_tbl'
					AND column_name = 'code' AND is_nullable = 'NO'
			)`,
		);
		expect(notNull).toBe(true);
	});
});
