import { describe, expect, test } from "bun:test";
import {
	CycleDetectedError,
	DuplicateMigrationIdError,
	MissingParentError,
	MissingRootError,
	MultipleRootsError,
} from "../src/errors.ts";
import { planOrder } from "../src/graph/dag.ts";
import type { Migration } from "../src/types.ts";

function m(id: number, parentId: number | null): Migration {
	return { id, parentId, operations: [] };
}

describe("planOrder", () => {
	test("orders parent before child", () => {
		const result = planOrder([m(2, 1), m(1, null)], new Set());
		expect(result.map((x) => x.id)).toEqual([1, 2]);
	});

	test("tiebreak siblings by id asc", () => {
		const result = planOrder([m(3, 1), m(2, 1), m(1, null)], new Set());
		expect(result.map((x) => x.id)).toEqual([1, 2, 3]);
	});

	test("filters already applied", () => {
		const result = planOrder([m(1, null), m(2, 1)], new Set([1]));
		expect(result.map((x) => x.id)).toEqual([2]);
	});

	test("allows parent only in appliedIds", () => {
		const result = planOrder([m(2, 1)], new Set([1]));
		expect(result.map((x) => x.id)).toEqual([2]);
	});

	test("duplicate id", () => {
		expect(() => planOrder([m(1, null), m(1, null)], new Set())).toThrow(DuplicateMigrationIdError);
	});

	test("missing root on empty history", () => {
		expect(() => planOrder([m(2, 1)], new Set())).toThrow(MissingRootError);
	});

	test("multiple roots on empty history", () => {
		expect(() => planOrder([m(1, null), m(2, null)], new Set())).toThrow(MultipleRootsError);
	});

	test("new root when history non-empty", () => {
		expect(() => planOrder([m(2, null)], new Set([1]))).toThrow(MultipleRootsError);
	});

	test("re-listed applied root is harmless", () => {
		const result = planOrder([m(1, null), m(2, 1)], new Set([1]));
		expect(result.map((x) => x.id)).toEqual([2]);
	});

	test("missing parent", () => {
		expect(() => planOrder([m(1, null), m(2, 99)], new Set())).toThrow(MissingParentError);
	});

	test("cycle detection", () => {
		const a: Migration = { id: 1, parentId: 2, operations: [] };
		const b: Migration = { id: 2, parentId: 1, operations: [] };
		// Root already in history — batch is only the cyclic pair
		expect(() => planOrder([a, b], new Set([100]))).toThrow(CycleDetectedError);
	});
});
