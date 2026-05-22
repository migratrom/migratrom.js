import { encode, decode } from "cbor-x";

type KnownHashes = "sha256" | "sha512" | "sha3-256" | "sha3-512";

type HashPacket = [KnownHashes, Uint8Array];

export function encodeHashPacket(hash: KnownHashes, data: Uint8Array): Uint8Array {
	return encode([hash, data]);
}

export function decodeHashPacket(data: Uint8Array): HashPacket {
	return decode(data);
}
