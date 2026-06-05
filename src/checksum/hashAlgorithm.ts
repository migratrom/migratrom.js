import { sha256 } from "../utilities/hashes/sha.ts";

export interface HashAlgorithm {
	readonly name: string;
	hash(input: Uint8Array): Promise<Uint8Array>;
}

export const sha256Algorithm: HashAlgorithm = {
	name: "sha256",
	async hash(input: Uint8Array): Promise<Uint8Array> {
		return (await sha256(input)).bytes;
	},
};

const registry = new Map<string, HashAlgorithm>([[sha256Algorithm.name, sha256Algorithm]]);

export function hashAlgorithmNamed(name: string): HashAlgorithm | undefined {
	return registry.get(name);
}

export const defaultHashAlgorithm = sha256Algorithm;
