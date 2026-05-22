import { describe, expect, test } from "bun:test";
import { createTable } from "../src/operations/createTable.ts";
import type { Migration, Operation } from "../src/types.ts";
import { bytesToHex } from "../src/utilities/encoding/bytes.ts";
import { encodeHashPacket } from "../src/utilities/hashes/packet.ts";
import { sha256 } from "../src/utilities/hashes/sha.ts";
import { stableStringify } from "../src/utilities/stableJson.ts";

const M: Migration = {
	id: 1,
	parentId: null,
	operations: [
		createTable("public", "user", [{ name: "id", typeSql: "SERIAL" }], {
			columns: ["id"],
		}),
	],
};

async function checksumHex(payload: string): Promise<string> {
	const digest = await sha256(payload);
	return bytesToHex(encodeHashPacket("sha256", digest.bytes));
}

describe("history payload + checksum", () => {
	test("checksum is HashPacket hex, not bare digest hex", async () => {
		const payload = stableStringify(M.operations);
		const checksum = await checksumHex(payload);
		const bareDigest = (await sha256(payload)).toHex();
		expect(checksum).not.toBe(bareDigest);
		expect(checksum.length).toBeGreaterThan(64);
	});

	test("payload round-trips semantically", () => {
		const payload = stableStringify(M.operations);
		expect(JSON.parse(payload)).toEqual(JSON.parse(stableStringify(M.operations)));
	});

	test("same operations with different key order produce identical payload", () => {
		const fromFactory = createTable("public", "user", [{ name: "id", typeSql: "SERIAL" }], {
			columns: ["id"],
		});

		const manual: Operation = {
			postcheck: fromFactory.postcheck,
			execute: fromFactory.execute,
			id: fromFactory.id,
			label: fromFactory.label,
			precheck: fromFactory.precheck,
		};

		const M1: Migration = { id: 1, parentId: null, operations: [fromFactory] };
		const M2: Migration = { id: 1, parentId: null, operations: [manual] };

		expect(stableStringify(M1.operations)).toBe(stableStringify(M2.operations));
		expect(stableStringify(M1.operations)).not.toBe(JSON.stringify(M1.operations));
	});

	test("edited operations change payload and checksum", async () => {
		const a = await checksumHex(stableStringify(M.operations));
		const edited: Migration = { ...M, operations: [] };
		const b = await checksumHex(stableStringify(edited.operations));
		expect(stableStringify(M.operations)).not.toBe(stableStringify(edited.operations));
		expect(a).not.toBe(b);
	});
});
