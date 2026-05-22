import { describe, expect, test } from "bun:test";
import {
	qualified,
	quoteIdent,
	quoteIdentList,
	quoteLiteral,
	regclassLiteral,
} from "../src/sql/identifiers.ts";

describe("quoteIdent", () => {
	test("quotes simple names", () => {
		expect(quoteIdent("user")).toBe('"user"');
	});

	test("escapes embedded double quotes", () => {
		expect(quoteIdent('weird"name')).toBe('"weird""name"');
	});

	test("rejects NUL", () => {
		expect(() => quoteIdent("a\0b")).toThrow("identifier contains NUL");
	});
});

describe("quoteLiteral", () => {
	test("quotes simple strings", () => {
		expect(quoteLiteral("hello")).toBe("'hello'");
	});

	test("escapes embedded single quotes", () => {
		expect(quoteLiteral("it's")).toBe("'it''s'");
	});
});

describe("qualified", () => {
	test("produces schema.table", () => {
		expect(qualified("public", "user")).toBe('"public"."user"');
	});
});

describe("regclassLiteral", () => {
	test("wraps qualified name as literal", () => {
		expect(regclassLiteral("public", "user")).toBe(`'"public"."user"'`);
	});
});

describe("quoteIdentList", () => {
	test("joins columns", () => {
		expect(quoteIdentList(["email", "name"])).toBe('"email", "name"');
	});
});
