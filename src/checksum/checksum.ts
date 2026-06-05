import { ConfigError, MigrationChecksumMismatchError } from "../errors.ts";
import type { Operation } from "../types.ts";
import { bytesToHex } from "../utilities/encoding/bytes.ts";
import { canonicalEncode } from "./canonicalEncoding.ts";
import { defaultHashAlgorithm, hashAlgorithmNamed, type HashAlgorithm } from "./hashAlgorithm.ts";

export interface ParsedChecksum {
	algo: string;
	hex: string;
}

export async function checksum(
	operations: Operation[],
	algorithm: HashAlgorithm = defaultHashAlgorithm,
): Promise<string> {
	const digest = await algorithm.hash(canonicalEncode(operations));
	return `${algorithm.name}/${bytesToHex(digest)}`;
}

export function parseChecksum(stored: string): ParsedChecksum {
	const slash = stored.indexOf("/");
	if (slash < 0) {
		throw new ConfigError(`malformed checksum (missing '/'): ${stored}`);
	}
	const algo = stored.slice(0, slash);
	const hex = stored.slice(slash + 1);
	if (!algo || !hex || !/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
		throw new ConfigError(`malformed checksum: ${stored}`);
	}
	return { algo, hex };
}

/** Verify a stored checksum against the current operation body. */
export async function verifyChecksum(
	stored: string,
	operations: Operation[],
	migrationId: number,
): Promise<void> {
	const parsed = parseChecksum(stored);
	const algorithm = hashAlgorithmNamed(parsed.algo);
	if (!algorithm) {
		throw new ConfigError(`unknown checksum algorithm: ${parsed.algo}`);
	}
	const actual = await checksum(operations, algorithm);
	const actualParsed = parseChecksum(actual);
	if (parsed.hex.toLowerCase() !== actualParsed.hex.toLowerCase()) {
		throw new MigrationChecksumMismatchError(migrationId, stored, actual);
	}
}
