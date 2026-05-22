import { describe, expect, test } from "bun:test";
import { sha256 } from "../../src/utilities/hashes/sha.ts";

/** NIST-style empty and short message vectors (hex). */
const VECTORS: { input: string; hex: string }[] = [
	{
		input: "",
		hex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
	},
	{
		input: "hello",
		hex: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
	},
	{
		input: "The quick brown fox jumps over the lazy dog",
		hex: "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
	},
];

describe("sha256", () => {
	for (const { input, hex } of VECTORS) {
		test(`string: ${input === "" ? "(empty)" : JSON.stringify(input)}`, async () => {
			const d = await sha256(input);
			expect(d.toHex()).toBe(hex);
			expect(d.bytes).toHaveLength(32);
		});
	}

	test("accepts Uint8Array same as UTF-8 string for ASCII", async () => {
		const bytes = new TextEncoder().encode("hello");
		const fromString = await sha256("hello");
		const fromBytes = await sha256(bytes);
		expect(fromBytes.toHex()).toBe(fromString.toHex());
		expect(fromBytes.toBase64()).toBe(fromString.toBase64());
	});

	test("base64 matches known encoding of digest bytes", async () => {
		const d = await sha256("hello");
		expect(d.toBase64()).toBe("LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=");
	});

	test("bytes view is stable", async () => {
		const d = await sha256("test");
		expect([...d.bytes]).toEqual([...d.bytes]);
		expect(d.toHex()).toBe([...d.bytes].map((b) => b.toString(16).padStart(2, "0")).join(""));
	});
});
