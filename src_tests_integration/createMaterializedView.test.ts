import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createMaterializedView, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const { db, close } = connectDb();
afterAll(() => close());

describe("createMaterializedView integration", () => {
	test("creates materialized view and skips on re-apply", async () => {
		const M: Migration = {
			id: 4301,
			parentId: null,
			operations: [
				createTable("public", "mat_src", [{ name: "id", typeSql: "SERIAL" }], dialect, {
					columns: ["id"],
				}),
				createMaterializedView(
					"public",
					"mat_src_count",
					"SELECT count(*)::bigint AS n FROM public.mat_src",
					dialect,
				),
			],
		};

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([4301]);

		const exists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_matviews
				WHERE schemaname = 'public' AND matviewname = 'mat_src_count'
			)`,
		);
		expect(exists).toBe(true);

		expect((await applyMigrations([M], { dialect, db })).applied).toEqual([]);
	});
});
