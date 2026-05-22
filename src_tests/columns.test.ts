import { describe, expect, test } from "bun:test";
import { renderColumnDef, renderColumnList } from "../src/sql/columns.ts";
import type { ColumnDef } from "../src/types.ts";

describe("renderColumnDef", () => {
	test("NOT NULL by default", () => {
		expect(renderColumnDef({ name: "id", typeSql: "SERIAL" })).toBe('"id" SERIAL NOT NULL');
	});

	test("nullable column omits NOT NULL", () => {
		expect(renderColumnDef({ name: "name", typeSql: "text", nullable: true })).toBe('"name" text');
	});

	test("includes default clause verbatim", () => {
		expect(
			renderColumnDef({
				name: "createdAt",
				typeSql: "timestamptz",
				defaultSql: "DEFAULT (now())",
			}),
		).toBe('"createdAt" timestamptz DEFAULT (now()) NOT NULL');
	});

	test("boolean default", () => {
		expect(
			renderColumnDef({
				name: "published",
				typeSql: "bool",
				defaultSql: "DEFAULT false",
			}),
		).toBe('"published" bool DEFAULT false NOT NULL');
	});
});

describe("renderColumnList", () => {
	test("joins with newline indent", () => {
		const cols: ColumnDef[] = [
			{ name: "id", typeSql: "SERIAL" },
			{ name: "email", typeSql: "text" },
		];
		expect(renderColumnList(cols)).toBe('"id" SERIAL NOT NULL,\n  "email" text NOT NULL');
	});
});
