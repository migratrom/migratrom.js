/**
 * Applied migrations are immutable in meaning, not just in the database.
 *
 * Editing a migration's operations after it has run is a common mistake (refactor,
 * reorder, delete an op). The stored checksum is the contract for what was actually
 * applied; diverging from it is treated as an error, not a silent re-plan.
 */
import "./setup.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { applyMigrations, createTable } from "../src/index.ts";
import { MigrationChecksumMismatchError } from "../src/errors.ts";
import type { Migration } from "../src/types.ts";
import { connectDb } from "./connect.ts";

const M: Migration = {
	id: 400,
	parentId: null,
	operations: [
		createTable("public", "widget", [{ name: "id", typeSql: "SERIAL" }], {
			columns: ["id"],
		}),
	],
};

describe("applyMigrations checksum verification", () => {
	const { db, close } = connectDb();
	afterAll(() => close());

	/** Changing operations for an already-applied migration id is rejected. */
	test("rejects edited operations on already-applied migration", async () => {
		await applyMigrations([M], { db });

		const edited: Migration = {
			...M,
			operations: [],
		};

		await expect(applyMigrations([edited], { db })).rejects.toThrow(MigrationChecksumMismatchError);
	});
});
