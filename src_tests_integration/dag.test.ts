/**
 * Migration ordering is derived from parentId, not from caller-supplied array order.
 *
 * Application code should not need to topological-sort migrations by hand. The
 * runner resolves dependencies so that, for example, a referenced table exists
 * before a foreign key is added — even when the input list is deliberately shuffled.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, addForeignKey, createTable } from "../src/index.ts";
import { defaultHistoryTable } from "../src/runner/history.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const userMigration: Migration = {
	id: 300,
	parentId: null,
	operations: [
		createTable("public", "user", [{ name: "id", typeSql: "SERIAL" }], {
			columns: ["id"],
		}),
	],
};

const postMigration: Migration = {
	id: 301,
	parentId: 300,
	operations: [
		createTable(
			"public",
			"post",
			[
				{ name: "id", typeSql: "SERIAL" },
				{ name: "authorId", typeSql: "integer" },
			],
			{ columns: ["id"] },
		),
		addForeignKey("public", "post", {
			name: "post_authorId_fkey",
			columns: ["authorId"],
			references: { table: "user", columns: ["id"] },
		}),
	],
};

describe("applyMigrations dag ordering", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** A child migration listed before its parent still applies in dependency order. */
	test("applies parent before child with foreign key", async () => {
		const result = await applyMigrations([postMigration, userMigration], { db });
		expect(result.applied).toEqual([300, 301]);

		const fkExists = await db.queryBool(
			`SELECT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'post_authorId_fkey'
				AND conrelid = '"public"."post"'::regclass
			)`,
		);
		expect(fkExists).toBe(true);
	});

	/**
	 * parent_id in the history row links the migration graph inside the DB,
	 * enabling external tooling to reconstruct the apply order from history alone.
	 */
	test("parent_id values written correctly to history", async () => {
		await applyMigrations([postMigration, userMigration], { db });

		const rows = await db.queryRows<{
			id: number | string;
			parent_id: number | string | null;
		}>(`SELECT id, parent_id FROM "${defaultHistoryTable()}" ORDER BY id`);

		expect(rows).toHaveLength(2);
		expect(Number(rows[0]!.id)).toBe(300);
		expect(rows[0]!.parent_id).toBeNull();
		expect(Number(rows[1]!.id)).toBe(301);
		expect(Number(rows[1]!.parent_id)).toBe(300);
	});
});

describe("applyMigrations addForeignKey with onDelete", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** ON DELETE CASCADE is wired through to the pg_constraint confdeltype column. */
	test("addForeignKey respects onDelete CASCADE", async () => {
		const accountM: Migration = {
			id: 310,
			parentId: null,
			operations: [
				createTable("public", "account", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
			],
		};
		const messageM: Migration = {
			id: 311,
			parentId: 310,
			operations: [
				createTable(
					"public",
					"message",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "account_id", typeSql: "integer" },
					],
					{ columns: ["id"] },
				),
				addForeignKey("public", "message", {
					name: "message_account_fkey",
					columns: ["account_id"],
					references: { table: "account", columns: ["id"] },
					onDelete: "CASCADE",
				}),
			],
		};

		await applyMigrations([accountM, messageM], { db });

		// confdeltype 'c' = CASCADE in pg_constraint
		const rows = await db.queryRows<{ confdeltype: string }>(
			`SELECT confdeltype FROM pg_constraint WHERE conname = 'message_account_fkey'`,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.confdeltype).toBe("c");
	});
});

describe("applyMigrations three-migration chain", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/**
	 * A linear chain longer than two migrations confirms depth-sorting holds
	 * across more than one edge of the dependency graph.
	 */
	test("applies three-deep chain in correct order when submitted reversed", async () => {
		const M1: Migration = {
			id: 320,
			parentId: null,
			operations: [
				createTable("public", "org", [{ name: "id", typeSql: "SERIAL" }], {
					columns: ["id"],
				}),
			],
		};
		const M2: Migration = {
			id: 321,
			parentId: 320,
			operations: [
				createTable(
					"public",
					"team",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "org_id", typeSql: "integer" },
					],
					{ columns: ["id"] },
				),
				addForeignKey("public", "team", {
					name: "team_org_fkey",
					columns: ["org_id"],
					references: { table: "org", columns: ["id"] },
				}),
			],
		};
		const M3: Migration = {
			id: 322,
			parentId: 321,
			operations: [
				createTable(
					"public",
					"member",
					[
						{ name: "id", typeSql: "SERIAL" },
						{ name: "team_id", typeSql: "integer" },
					],
					{ columns: ["id"] },
				),
				addForeignKey("public", "member", {
					name: "member_team_fkey",
					columns: ["team_id"],
					references: { table: "team", columns: ["id"] },
				}),
			],
		};

		// Submit in reverse order: deepest child first
		const result = await applyMigrations([M3, M2, M1], { db });
		expect(result.applied).toEqual([320, 321, 322]);

		const memberFkExists = await db.queryBool(
			`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_team_fkey')`,
		);
		expect(memberFkExists).toBe(true);
	});
});
