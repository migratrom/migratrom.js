import { describe, expect, test } from "bun:test";
import { CheckShapeError } from "../src/errors.ts";
import { parseCheckRows, parseScalarRows } from "../src/db/queryResult.ts";

describe("parseCheckRows", () => {
	test("accepts single boolean column with arbitrary name", () => {
		expect(parseCheckRows([{ ok: true }])).toBe(true);
		expect(parseCheckRows([{ "?column?": false }])).toBe(false);
	});

	test("rejects zero rows", () => {
		expect(() => parseCheckRows([])).toThrow(CheckShapeError);
		try {
			parseCheckRows([]);
		} catch (err) {
			expect(err).toBeInstanceOf(CheckShapeError);
			expect((err as CheckShapeError).baseMessage).toContain("exactly one row");
		}
	});

	test("rejects multiple rows", () => {
		expect(() => parseCheckRows([{ a: true }, { a: false }])).toThrow(CheckShapeError);
	});

	test("rejects multiple columns", () => {
		expect(() => parseCheckRows([{ a: true, b: false }])).toThrow(CheckShapeError);
	});

	test("rejects non-boolean value", () => {
		expect(() => parseCheckRows([{ a: "yes" }])).toThrow(CheckShapeError);
		try {
			parseCheckRows([{ a: 1 }]);
		} catch (err) {
			expect((err as CheckShapeError).baseMessage).toContain("boolean");
			expect((err as CheckShapeError).rowPreview).toBeDefined();
		}
	});

	test("rejects non-object row", () => {
		expect(() => parseCheckRows([null])).toThrow(CheckShapeError);
		expect(() => parseCheckRows([["x"]])).toThrow(CheckShapeError);
	});
});

describe("parseScalarRows", () => {
	test("returns undefined for zero rows", () => {
		expect(parseScalarRows([])).toBeUndefined();
	});

	test("returns first column value for one row", () => {
		expect(parseScalarRows<number>([{ n: 42 }])).toBe(42);
		expect(parseScalarRows<string>([{ x: "hi" }])).toBe("hi");
	});

	test("rejects multiple rows", () => {
		expect(() => parseScalarRows([{ a: 1 }, { a: 2 }])).toThrow(CheckShapeError);
	});

	test("rejects multiple columns", () => {
		expect(() => parseScalarRows([{ a: 1, b: 2 }])).toThrow(CheckShapeError);
	});

	test("rejects malformed row when non-empty", () => {
		expect(() => parseScalarRows([null])).toThrow(CheckShapeError);
		expect(() => parseScalarRows([["x"]])).toThrow(CheckShapeError);
	});
});

describe("CheckShapeError.withContext", () => {
	test("merges operation and check fields into message", () => {
		const err = new CheckShapeError("check must return a boolean, got string", {
			rowPreview: '{"a":"x"}',
		}).withContext({
			operationId: "table.user",
			description: "verify table exists",
			sql: "SELECT 1",
		});
		expect(err.operationId).toBe("table.user");
		expect(err.description).toBe("verify table exists");
		expect(err.sql).toBe("SELECT 1");
		expect(err.message).toContain("table.user");
		expect(err.message).toContain("verify table exists");
		expect(err.message).toContain("SELECT 1");
	});
});
