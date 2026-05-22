/**
 * createIndex integration tests.
 *
 * Non-concurrent indexes run inside the per-migration transaction (the normal path).
 * CONCURRENTLY indexes set outsideTransaction:true, which forces the runner through
 * the segmented-transaction path — the most complex branch in applyMigrations that
 * is not reachable via any other exported operation.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createIndex, createTable } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("createIndex integration", () => {
	/** Standard (non-concurrent) index runs inside the migration transaction. */
	test("creates a non-concurrent index", async () => {
		const M: Migration = {
			id: 1,
			parentId: null,
			operations: [
				createTable(
					"public",
					"product",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "name", typeSql: "text" },
					],
					{ columns: ["id"] },
				),
				createIndex("public", "product", "product_name_idx", ["name"]),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([1]);
		expect(result.skippedOps).toEqual([]);

		const indexExists = await db.queryBool(
			`SELECT to_regclass('"public"."product_name_idx"') IS NOT NULL`,
		);
		expect(indexExists).toBe(true);
	});

	/**
	 * CREATE INDEX CONCURRENTLY cannot run inside a transaction. Setting
	 * concurrently:true marks the op with outsideTransaction:true, which
	 * triggers the segmented-transaction path: transactional ops are flushed
	 * first, then the index is created outside, then history is recorded.
	 */
	test("creates index CONCURRENTLY via the outsideTransaction path", async () => {
		const M: Migration = {
			id: 2,
			parentId: null,
			operations: [
				createTable(
					"public",
					"article",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "slug", typeSql: "text" },
					],
					{ columns: ["id"] },
				),
				createIndex("public", "article", "article_slug_idx", ["slug"], {
					concurrently: true,
				}),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([2]);

		const indexExists = await db.queryBool(
			`SELECT to_regclass('"public"."article_slug_idx"') IS NOT NULL`,
		);
		expect(indexExists).toBe(true);
	});

	/**
	 * If the index already exists when the migration runs (e.g., created by a
	 * previous partial run or manually), the op's postcheck passes immediately
	 * and the op is skipped. The migration is still recorded in history.
	 */
	test("op skipped when index pre-exists; migration still recorded", async () => {
		await db.execute(
			`CREATE TABLE public.catalog (id SERIAL NOT NULL, code text NOT NULL, PRIMARY KEY (id))`,
		);
		await db.execute(`CREATE INDEX catalog_code_idx ON public.catalog ("code")`);

		const M: Migration = {
			id: 3,
			parentId: null,
			operations: [createIndex("public", "catalog", "catalog_code_idx", ["code"])],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([3]);
		expect(result.skippedOps).toEqual(["index.catalog.catalog_code_idx"]);
	});
});
