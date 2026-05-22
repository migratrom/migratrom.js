import { describe, expect, test } from "bun:test";
import {
	base32ToBytes,
	base62ToBytes,
	base64ToBytes,
	bytesToBase32,
	bytesToBase62,
	bytesToBase64,
	bytesToHex,
	hexToBytes,
} from "../../src/utilities/encoding/bytes.ts";

const HELLO = new TextEncoder().encode("Hello");

function expectRoundTrip(
	encode: (b: Uint8Array) => string,
	decode: (s: string) => Uint8Array,
	bytes: Uint8Array,
) {
	expect(decode(encode(bytes))).toEqual(bytes);
}

describe("hex", () => {
	test("empty", () => {
		expect(bytesToHex(new Uint8Array(0))).toBe("");
		expect(hexToBytes("")).toEqual(new Uint8Array(0));
	});

	test("known vector", () => {
		expect(bytesToHex(HELLO)).toBe("48656c6c6f");
		expect(hexToBytes("48656c6c6f")).toEqual(HELLO);
	});

	test("ignores colon and space separators", () => {
		expect(hexToBytes("48:65 6c 6c 6f")).toEqual(HELLO);
	});

	test("rejects odd length", () => {
		expect(() => hexToBytes("abc")).toThrow("Invalid hex string length");
	});

	test("round-trips arbitrary bytes", () => {
		const bytes = new Uint8Array([0, 1, 255, 127, 42, 0, 0]);
		expectRoundTrip(bytesToHex, hexToBytes, bytes);
	});
});

describe("base64", () => {
	test("empty", () => {
		expect(bytesToBase64(new Uint8Array(0))).toBe("");
		expect(base64ToBytes("")).toEqual(new Uint8Array(0));
	});

	test("known vector", () => {
		expect(bytesToBase64(HELLO)).toBe("SGVsbG8=");
		expect(base64ToBytes("SGVsbG8=")).toEqual(HELLO);
	});

	test("round-trips arbitrary bytes", () => {
		const bytes = new Uint8Array([0, 1, 255, 127, 42, 99, 200]);
		expectRoundTrip(bytesToBase64, base64ToBytes, bytes);
	});
});

describe("base32", () => {
	test("empty", () => {
		expect(bytesToBase32(new Uint8Array(0))).toBe("");
		expect(base32ToBytes("")).toEqual(new Uint8Array(0));
	});

	test("known vector", () => {
		expect(bytesToBase32(HELLO)).toBe("JBSWY3DP");
		expect(base32ToBytes("JBSWY3DP")).toEqual(HELLO);
	});

	test("case-insensitive decode", () => {
		expect(base32ToBytes("jbswy3dp")).toEqual(HELLO);
	});

	test("rejects invalid character", () => {
		expect(() => base32ToBytes("JBSWY3DPEBLW64TMMQQQ!!!")).toThrow("Invalid Base32 character");
	});

	test("round-trips arbitrary bytes", () => {
		const bytes = new Uint8Array([0, 1, 255, 127, 42, 13, 7]);
		expectRoundTrip(bytesToBase32, base32ToBytes, bytes);
	});
});

describe("base62", () => {
	test("empty", () => {
		expect(bytesToBase62(new Uint8Array(0))).toBe("");
		expect(base62ToBytes("")).toEqual(new Uint8Array(0));
	});

	test("preserves leading zero bytes", () => {
		const bytes = new Uint8Array([0, 0, 1, 2]);
		const encoded = bytesToBase62(bytes);
		expect(encoded.startsWith("00")).toBe(true);
		expect(base62ToBytes(encoded)).toEqual(bytes);
	});

	test("single zero byte", () => {
		expect(bytesToBase62(new Uint8Array([0]))).toBe("0");
		expect(base62ToBytes("0")).toEqual(new Uint8Array([0]));
	});

	test("rejects invalid character", () => {
		expect(() => base62ToBytes("abc+")).toThrow("Invalid Base62 character");
	});

	test("round-trips small and large buffers", () => {
		for (const bytes of [
			new Uint8Array([1]),
			new Uint8Array([255]),
			new Uint8Array([0, 255, 0, 1]),
			new Uint8Array(32).map((_, i) => i * 7),
			crypto.getRandomValues(new Uint8Array(64)),
		]) {
			expectRoundTrip(bytesToBase62, base62ToBytes, bytes);
		}
	});
});
