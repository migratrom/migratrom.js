import { describe, expect, test } from "bun:test";
import { stableStringify } from "../../src/utilities/stableJson.ts";

describe("stableStringify", () => {
	test("sorts object keys", () => {
		const a = stableStringify({ z: 1, a: 2, m: 3 });
		const b = stableStringify({ a: 2, m: 3, z: 1 });
		expect(a).toBe(b);
		expect(a).toBe('{"a":2,"m":3,"z":1}');
	});

	test("omits undefined keys like JSON.stringify", () => {
		expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
	});

	test("preserves array order", () => {
		expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
		expect(stableStringify([3, 1, 2])).not.toBe(stableStringify([1, 2, 3]));
	});

	test("nested objects sort keys at each level", () => {
		expect(stableStringify({ b: { z: 1, a: 2 }, a: 0 })).toBe('{"a":0,"b":{"a":2,"z":1}}');
	});

	test("nested arrays keep order", () => {
		expect(
			stableStringify({
				x: [
					[2, 1],
					[4, 3],
				],
			}),
		).toBe('{"x":[[2,1],[4,3]]}');
	});

	test("primitives match JSON.stringify", () => {
		expect(stableStringify(null)).toBe("null");
		expect(stableStringify(true)).toBe("true");
		expect(stableStringify(false)).toBe("false");
		expect(stableStringify(42)).toBe("42");
		expect(stableStringify("hi")).toBe('"hi"');
	});

	test("top-level undefined is literal undefined", () => {
		expect(stableStringify(undefined)).toBe("undefined");
	});

	test("undefined array elements stringify as undefined literal", () => {
		expect(stableStringify([1, undefined, 2])).toBe("[1,undefined,2]");
	});

	test("empty object and array", () => {
		expect(stableStringify({})).toBe("{}");
		expect(stableStringify([])).toBe("[]");
	});

	test("unicode keys sort by code point", () => {
		expect(stableStringify({ "\u{1F4A9}": 1, a: 2 })).toBe('{"a":2,"💩":1}');
	});

	test("is stable across repeated calls", () => {
		const value = { z: [{ b: 2, a: 1 }], a: "x" };
		const once = stableStringify(value);
		for (let i = 0; i < 20; i++) {
			expect(stableStringify(value)).toBe(once);
		}
	});
});
