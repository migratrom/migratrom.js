/**
 * Serializes a value to JSON with deterministic object key order.
 *
 * - Object keys are sorted lexicographically (Unicode code point order).
 * - Keys whose value is `undefined` are omitted (same as `JSON.stringify` on objects).
 * - Array element order is preserved.
 * - Top-level `undefined` becomes the literal string `"undefined"` (not valid JSON).
 *
 * @param value - Any JSON-serializable value (plus `undefined` at the root).
 * @returns Stable JSON string suitable for hashing or comparison.
 *
 * @example
 * ```ts
 * stableStringify({ z: 1, a: 2 }); // '{"a":2,"z":1}'
 * ```
 */
export function stableStringify(value: unknown): string {
	if (value === undefined) {
		return "undefined";
	}
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj)
		.filter((key) => obj[key] !== undefined)
		.sort();
	const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
	return `{${entries.join(",")}}`;
}
