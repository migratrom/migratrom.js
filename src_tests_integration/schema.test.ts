/**
 * Non-public schema tests.
 *
 * All first-class operations accept a schema argument. These tests confirm that
 * quoting, regclass lookups, and constraint checks work correctly when the schema
 * is not "public". The history table stays in public (default search_path);
 * only the user tables live in the custom schema.
 *
 * The custom schema is created in describe-level beforeEach (after the global
 * beforeEach drops/recreates public) and dropped in describe-level afterEach.
 */
import "./setup.ts";
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyMigrations, addForeignKey, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("non-public schema operations", () => {
	beforeEach(async () => {
		await db.execute("CREATE SCHEMA IF NOT EXISTS app");
	});

	afterEach(async () => {
		await db.execute("DROP SCHEMA IF EXISTS app CASCADE");
	});

	/** createTable correctly quotes the schema name in both DDL and catalog checks. */
	test("createTable in custom schema", async () => {
		const M: Migration = {
			id: 1,
			parentId: null,
			operations: [
				createTable(
					"app",
					"widget",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "name", typeSql: "text" },
					],
					{ columns: ["id"] },
				),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([1]);

		const exists = await db.queryBool(`SELECT to_regclass('"app"."widget"') IS NOT NULL`);
		expect(exists).toBe(true);
	});

	/** addForeignKey uses the schema for both sides of the relation reference. */
	test("addForeignKey between tables in custom schema", async () => {
		const M: Migration = {
			id: 2,
			parentId: null,
			operations: [
				createTable("app", "customer", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
				createTable(
					"app",
					"orders",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "customer_id", typeSql: "integer" },
					],
					{ columns: ["id"] },
				),
				addForeignKey("app", "orders", {
					name: "orders_customer_fkey",
					columns: ["customer_id"],
					references: { table: "customer", columns: ["id"] },
				}),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([2]);

		const fkExists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'orders_customer_fkey'
				AND conrelid = '"app"."orders"'::regclass
			)`,
		);
		expect(fkExists).toBe(true);
	});
});
