/** @internal */
function assertTruthy<T>(value: T | null | undefined): T {
	if (value === null || value === undefined) {
		throw new Error("Value is null or undefined");
	}
	return value;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
// ============================================================================
// HEX (Base16)
// ============================================================================

/**
 * Encodes bytes as lowercase hexadecimal (two digits per byte, no separator).
 *
 * @param bytes - Input buffer.
 * @returns Hex string, or `""` for an empty buffer.
 */
export function bytesToHex(bytes: Uint8Array): string {
	let hex = "";
	for (let i = 0; i < bytes.length; i++) {
		hex += assertTruthy(bytes[i]).toString(16).padStart(2, "0");
	}
	return hex;
}

/**
 * Decodes a hex string into bytes. Ignores optional `:` and whitespace separators.
 *
 * @param hex - Hex digits (even count after normalization).
 * @throws {Error} If the normalized length is odd.
 */
export function hexToBytes(hex: string): Uint8Array {
	// Normalize string: remove spaces/colons if present, ensure even length
	const cleanHex = hex.replace(/[:\s]/g, "");
	if (cleanHex.length % 2 !== 0) {
		throw new Error("Invalid hex string length");
	}

	const bytes = new Uint8Array(cleanHex.length / 2);
	for (let i = 0; i < cleanHex.length; i += 2) {
		bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
	}
	return bytes;
}

// ============================================================================
// BASE64 (Standard RFC 4648)
// ============================================================================

/**
 * Encodes bytes as standard Base64 (RFC 4648, `btoa` alphabet).
 *
 * @param bytes - Input buffer.
 */
export function bytesToBase64(bytes: Uint8Array): string {
	// Using native btoa via a binary string mapping for compatibility
	let binary = "";
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(assertTruthy(bytes[i]));
	}
	return btoa(binary);
}

/**
 * Decodes standard Base64 into bytes.
 *
 * @param base64 - RFC 4648 Base64 string.
 */
export function base64ToBytes(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

// ============================================================================
// BASE32 (Standard RFC 4648 - A-Z, 2-7)
// ============================================================================

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes bytes as standard Base32 (RFC 4648: A–Z and 2–7, `=` padding to multiple of 8).
 *
 * @param bytes - Input buffer.
 */
export function bytesToBase32(bytes: Uint8Array): string {
	let result = "";
	let bits = 0;
	let value = 0;

	for (let i = 0; i < bytes.length; i++) {
		value = (value << 8) | assertTruthy(bytes[i]);
		bits += 8;
		while (bits >= 5) {
			result += B32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}

	if (bits > 0) {
		result += B32_ALPHABET[(value << (5 - bits)) & 31];
	}

	// Padding to multiple of 8 characters
	while (result.length % 8 !== 0) {
		result += "=";
	}

	return result;
}

/**
 * Decodes Base32 into bytes. Case-insensitive; padding `=` is optional.
 *
 * @param b32 - Base32 string.
 * @throws {Error} If a character is outside the alphabet.
 */
export function base32ToBytes(b32: string): Uint8Array {
	const cleanB32 = b32.toUpperCase().replace(/=/g, "");
	const bytes: number[] = [];
	let bits = 0;
	let value = 0;

	for (let i = 0; i < cleanB32.length; i++) {
		const idx = B32_ALPHABET.indexOf(assertTruthy(cleanB32[i]));
		if (idx === -1) throw new Error(`Invalid Base32 character: ${cleanB32[i]}`);

		value = (value << 5) | idx;
		bits += 5;

		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}

	return new Uint8Array(bytes);
}

// ============================================================================
// BASE62 (Alphanumeric: 0-9, A-Z, a-z)
// ============================================================================

const B62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Encodes bytes as Base62 (0–9, A–Z, a–z). Leading zero bytes map to leading `'0'` chars.
 *
 * @param bytes - Input buffer.
 * @returns Base62 string, or `""` for an empty buffer.
 */
export function bytesToBase62(bytes: Uint8Array): string {
	if (bytes.length === 0) return "";

	// Count leading zeros so we can preserve them in the output
	let leadingZeros = 0;
	while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
		leadingZeros++;
	}

	// Convert bytes to a base-256 array we can mutate during division
	let digits = Array.from(bytes);
	const result: number[] = [];

	// Repeatedly divide the large number by 62
	let startAt = leadingZeros;
	while (startAt < digits.length) {
		let remainder = 0;
		for (let i = startAt; i < digits.length; i++) {
			const current = remainder * 256 + assertTruthy(digits[i]);
			digits[i] = Math.floor(current / 62);
			remainder = current % 62;
		}

		result.push(remainder);

		// Advance the start pointer if high-order bytes became 0
		while (startAt < digits.length && digits[startAt] === 0) {
			startAt++;
		}
	}

	// Map remainders to our alphabet (they are generated in reverse order)
	let b62String = result
		.reverse()
		.map((r) => B62_ALPHABET[r])
		.join("");

	// Prepend the preserved leading zeros mapped to the first char of alphabet ('0')
	return assertTruthy(B62_ALPHABET[0]).repeat(leadingZeros) + assertTruthy(b62String);
}

/**
 * Decodes Base62 into bytes. Leading `'0'` chars restore leading zero bytes.
 *
 * @param b62 - Base62 string.
 * @throws {Error} If a character is outside the alphabet.
 */
export function base62ToBytes(b62: string): Uint8Array {
	if (b62.length === 0) return new Uint8Array(0);

	// Count leading zeros to preserve them
	let leadingZeros = 0;
	while (leadingZeros < b62.length && b62[leadingZeros] === B62_ALPHABET[0]) {
		leadingZeros++;
	}

	// Convert Base62 characters to their numeric values
	const digits: number[] = [];
	for (let i = 0; i < b62.length; i++) {
		const idx = B62_ALPHABET.indexOf(assertTruthy(b62[i]));
		if (idx === -1) throw new Error(`Invalid Base62 character: ${b62[i]}`);
		digits.push(idx);
	}

	const result: number[] = [];
	let startAt = leadingZeros;

	// Repeatedly divide the large number by 256 to extract bytes
	while (startAt < digits.length) {
		let remainder = 0;
		for (let i = startAt; i < digits.length; i++) {
			const current = remainder * 62 + assertTruthy(digits[i]);
			digits[i] = Math.floor(current / 256);
			remainder = current % 256;
		}

		result.push(remainder);

		while (startAt < digits.length && digits[startAt] === 0) {
			startAt++;
		}
	}

	// Build the final Uint8Array including the preserved leading zeros
	const totalLength = leadingZeros + result.length;
	const bytes = new Uint8Array(totalLength);

	// result is in reverse order, so we populate from the back
	for (let i = 0; i < result.length; i++) {
		const c = totalLength - 1 - i;
		bytes[c] = assertTruthy(result[i]);
	}

	return bytes;
}
