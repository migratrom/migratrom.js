import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createExtension } from "../src/index.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("createExtension integration", () => {
	test("creates plpgsql extension if missing and skips on re-apply", async () => {
		const M: Migration = {
			id: 3401,
			parentId: null,
			operations: [createExtension("plpgsql")],
		};

		const first = await applyMigrations([M], { db });
		expect(first.applied).toEqual([3401]);

		const exists = await db.queryBool(
			`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'plpgsql')`,
		);
		expect(exists).toBe(true);

		const second = await applyMigrations([M], { db });
		expect(second.applied).toEqual([]);
	});
});
