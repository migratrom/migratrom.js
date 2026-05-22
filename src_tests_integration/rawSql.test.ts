/**
 * rawSql integration tests.
 *
 * rawSql is the general-purpose escape hatch for DDL that has no first-class
 * operation. It accepts arbitrary execute/precheck/postcheck SQL, normalises
 * ids and descriptions, and participates in the same skip/precheck/postcheck
 * machinery as every other operation.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, rawSql } from "../src/index.ts";
import { MigrationFailedError, PrecheckFailedError } from "../src/errors.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const { db, close } = connectDb();
afterAll(() => close());

describe("rawSql integration", () => {
	/** rawSql can run any DDL and verifies the result via its postcheck. */
	test("executes arbitrary DDL and verifies via postcheck", async () => {
		const M: Migration = {
			id: 1,
			parentId: null,
			operations: [
				rawSql({
					label: "create sequence raw_seq",
					execute: [{ sql: "CREATE SEQUENCE public.raw_seq" }],
					postcheck: [
						{
							description: "verify raw_seq exists",
							sql: `SELECT to_regclass('"public"."raw_seq"') IS NOT NULL`,
						},
					],
				}),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([1]);
		expect(result.skippedOps).toEqual([]);

		const exists = await db.queryBool(`SELECT to_regclass('"public"."raw_seq"') IS NOT NULL`);
		expect(exists).toBe(true);
	});

	/**
	 * When the postcheck already passes before execute runs, the op is skipped.
	 * This exercises the shared skip path in runOperation used by all operations.
	 */
	test("op skipped when postcheck already passes (pre-existing state)", async () => {
		await db.execute("CREATE SEQUENCE public.pre_seq");

		const M: Migration = {
			id: 2,
			parentId: null,
			operations: [
				rawSql({
					id: "seq.pre_seq",
					label: "create sequence pre_seq",
					execute: [{ sql: "CREATE SEQUENCE public.pre_seq" }],
					postcheck: [{ sql: `SELECT to_regclass('"public"."pre_seq"') IS NOT NULL` }],
				}),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([2]);
		expect(result.skippedOps).toEqual(["seq.pre_seq"]);
	});

	/**
	 * A precheck that returns false blocks execute and throws PrecheckFailedError
	 * (wrapped in MigrationFailedError).
	 */
	test("failing precheck throws MigrationFailedError wrapping PrecheckFailedError", async () => {
		const M: Migration = {
			id: 3,
			parentId: null,
			operations: [
				rawSql({
					label: "step that requires prereq table",
					precheck: [
						{
							description: 'table "prereq" must exist',
							sql: `SELECT to_regclass('"public"."prereq"') IS NOT NULL`,
						},
					],
					execute: [{ sql: "CREATE SEQUENCE public.raw_seq2" }],
					postcheck: [{ sql: `SELECT to_regclass('"public"."raw_seq2"') IS NOT NULL` }],
				}),
			],
		};

		let thrown: unknown;
		try {
			await applyMigrations([M], { db });
		} catch (err) {
			thrown = err;
		}

		expect(thrown).toBeInstanceOf(MigrationFailedError);
		expect((thrown as MigrationFailedError).cause).toBeInstanceOf(PrecheckFailedError);
	});

	/** A passing precheck allows execute to proceed normally. */
	test("passing precheck allows execute to proceed", async () => {
		await db.execute(`CREATE TABLE public.prereq (id SERIAL PRIMARY KEY)`);

		const M: Migration = {
			id: 4,
			parentId: null,
			operations: [
				rawSql({
					label: "step that requires prereq table",
					precheck: [
						{
							description: 'table "prereq" must exist',
							sql: `SELECT to_regclass('"public"."prereq"') IS NOT NULL`,
						},
					],
					execute: [{ sql: "CREATE SEQUENCE public.gated_seq" }],
					postcheck: [{ sql: `SELECT to_regclass('"public"."gated_seq"') IS NOT NULL` }],
				}),
			],
		};

		const result = await applyMigrations([M], { db });
		expect(result.applied).toEqual([4]);

		const exists = await db.queryBool(`SELECT to_regclass('"public"."gated_seq"') IS NOT NULL`);
		expect(exists).toBe(true);
	});
});
