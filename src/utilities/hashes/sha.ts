import { bytesToBase64, bytesToHex } from "../encoding/bytes.ts";

/** SHA-256 digest with lazy encodings. */
export interface Sha256Digest {
	/** Raw 32-byte digest. */
	readonly bytes: Uint8Array;
	/** Lowercase hex encoding (no prefix). */
	toHex(): string;
	/** Standard Base64 encoding (RFC 4648). */
	toBase64(): string;
}

/**
 * Computes SHA-256 over a UTF-8 string or byte buffer.
 *
 * @param input - Plain text (encoded as UTF-8) or raw bytes.
 * @returns Digest with {@link Sha256Digest.toHex} and {@link Sha256Digest.toBase64}.
 *
 * @example
 * ```ts
 * const d = await sha256("hello");
 * d.toHex(); // "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 * ```
 */
export async function sha256(input: string | Uint8Array): Promise<Sha256Digest> {
	const data = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(hash);
	return {
		get bytes(): Uint8Array {
			return bytes;
		},
		toHex(): string {
			return bytesToHex(bytes);
		},
		toBase64(): string {
			return bytesToBase64(bytes);
		},
	};
}
