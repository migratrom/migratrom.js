import { describe, expect, test } from "bun:test";
import { EmptyPostcheckError, PostcheckFailedError, PrecheckFailedError } from "../src/errors.ts";
import { FakeDb } from "../src/db/fake.ts";
import { runOperation } from "../src/runner/executor.ts";
import type { Operation } from "../src/types.ts";

const noopLog = { info: () => {}, warn: () => {}, error: () => {} };

const sampleOp: Operation = {
	id: "test.op",
	label: "Test op",
	precheck: [{ description: "pre", sql: "SELECT pre" }],
	execute: [{ description: "exec", sql: "DO THING" }],
	postcheck: [{ description: "post", sql: "SELECT post" }],
};

describe("runOperation", () => {
	test("skips when postcheck already true", async () => {
		const db = new FakeDb();
		db.setBool("SELECT post", true);
		const result = await runOperation(db, sampleOp, noopLog);
		expect(result).toBe("skipped");
		expect(db.executed).toHaveLength(0);
	});

	test("executes when postcheck false then true", async () => {
		const db = new FakeDb();
		let postCalls = 0;
		const origQueryBool = db.queryBool.bind(db);
		db.queryBool = async (sql: string) => {
			if (sql === "SELECT post") return ++postCalls > 1;
			if (sql === "SELECT pre") return true;
			return origQueryBool(sql);
		};
		const result = await runOperation(db, sampleOp, noopLog);
		expect(result).toBe("executed");
		expect(db.executed).toEqual(["DO THING"]);
	});

	test("precheck failure", async () => {
		const db = new FakeDb();
		db.setBool("SELECT post", false);
		db.setBool("SELECT pre", false);
		await expect(runOperation(db, sampleOp, noopLog)).rejects.toThrow(PrecheckFailedError);
	});

	test("postcheck failure after execute", async () => {
		const db = new FakeDb();
		let postCalls = 0;
		const origQueryBool = db.queryBool.bind(db);
		db.queryBool = async (sql: string) => {
			if (sql === "SELECT post") {
				postCalls++;
				return postCalls === 1 ? false : false;
			}
			if (sql === "SELECT pre") return true;
			return origQueryBool(sql);
		};
		await expect(runOperation(db, sampleOp, noopLog)).rejects.toThrow(PostcheckFailedError);
		expect(db.executed).toEqual(["DO THING"]);
	});

	test("empty postcheck throws", async () => {
		const db = new FakeDb();
		const bad = { ...sampleOp, postcheck: [] };
		await expect(runOperation(db, bad, noopLog)).rejects.toThrow(EmptyPostcheckError);
	});

	test("withTransaction rolls back on failure", async () => {
		const db = new FakeDb();
		db.setBool("SELECT post", false);
		db.setBool("SELECT pre", false);
		await expect(
			db.withTransaction(async () => {
				await runOperation(db, sampleOp, noopLog);
			}),
		).rejects.toThrow(PrecheckFailedError);
		expect(db.wasRolledBack()).toBe(true);
		expect(db.executed).toHaveLength(0);
	});
});
