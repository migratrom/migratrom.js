import { afterEach, describe, expect, test } from "bun:test";
import Database from "libsql";
import { libsqlAdapter } from "../src/adapters/sqlite.ts";
import { CheckShapeError } from "../src/errors.ts";

let database: Database.Database | undefined;

afterEach(() => {
	database?.close();
	database = undefined;
});

function connect() {
	database = new Database(":memory:");
	return libsqlAdapter(database);
}

describe("libsqlAdapter", () => {
	test("queries rows, scalar values, and SQLite booleans", async () => {
		const db = connect();
		await db.execute("CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT)");
		await db.execute("INSERT INTO item (id, name) VALUES (1, 'one')");

		expect(await db.queryRows("SELECT id, name FROM item")).toEqual([{ id: 1, name: "one" }]);
		expect(await db.queryScalar<number>("SELECT count(*) FROM item")).toBe(1);
		expect(await db.queryBool("SELECT EXISTS (SELECT 1 FROM item)")).toBe(true);
		expect(await db.queryBool("SELECT NOT EXISTS (SELECT 1 FROM item)")).toBe(false);
	});

	test("rejects malformed boolean checks", async () => {
		const db = connect();
		await expect(db.queryBool("SELECT 1 AS a, 0 AS b")).rejects.toThrow(CheckShapeError);
		await expect(db.queryBool("SELECT 'yes' AS value")).rejects.toThrow(CheckShapeError);
	});

	test("reuses nested transactions", async () => {
		const db = connect();
		await db.execute("CREATE TABLE item (id INTEGER PRIMARY KEY)");
		await db.withTransaction(async () => {
			await db.execute("INSERT INTO item VALUES (1)");
			await db.withTransaction(async () => {
				await db.execute("INSERT INTO item VALUES (2)");
			});
		});
		expect(await db.queryScalar<number>("SELECT count(*) FROM item")).toBe(2);
	});

	test("rolls back failed transactions", async () => {
		const db = connect();
		await db.execute("CREATE TABLE item (id INTEGER PRIMARY KEY)");
		await expect(
			db.withTransaction(async () => {
				await db.execute("INSERT INTO item VALUES (1)");
				throw new Error("stop");
			}),
		).rejects.toThrow("stop");
		expect(await db.queryScalar<number>("SELECT count(*) FROM item")).toBe(0);
	});
});
