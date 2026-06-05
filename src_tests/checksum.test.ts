import { describe, expect, test } from "bun:test";
import { canonicalEncode } from "../src/checksum/canonicalEncoding.ts";
import { checksum, parseChecksum, verifyChecksum } from "../src/checksum/checksum.ts";
import { ConfigError, MigrationChecksumMismatchError } from "../src/errors.ts";
import type { Operation } from "../src/types.ts";
import { bytesToHex } from "../src/utilities/encoding/bytes.ts";

const operation: Operation = {
	id: "table.user",
	label: 'Create table "user"',
	precheck: [
		{
			description: 'ensure table "public"."user" does not exist',
			sql: `SELECT NOT EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'user'
)`,
		},
	],
	execute: [
		{
			description: 'create table "user"',
			sql: `CREATE TABLE "public"."user" (
  "id" bigint PRIMARY KEY
)`,
		},
	],
	postcheck: [
		{
			description: 'ensure table "public"."user" exists',
			sql: `SELECT EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'user'
)`,
		},
	],
};

const canonicalHex =
	"000000106d6967726174726f6d2f6f70732f7631000000010000000a7461626c652e7573657200000013437265617465207461626c652022757365722200000000010000002b656e73757265207461626c6520227075626c6963222e22757365722220646f6573206e6f742065786973740000009453454c454354204e4f542045584953545320280a202053454c45435420312046524f4d2070675f636c61737320630a20204a4f494e2070675f6e616d657370616365206e204f4e206e2e6f6964203d20632e72656c6e616d6573706163650a20205748455245206e2e6e73706e616d65203d20277075626c69632720414e4420632e72656c6e616d65203d202775736572270a290000000100000013637265617465207461626c65202275736572220000003a435245415445205441424c4520227075626c6963222e22757365722220280a20202269642220626967696e74205052494d415259204b45590a290000000100000023656e73757265207461626c6520227075626c6963222e227573657222206578697374730000009053454c4543542045584953545320280a202053454c45435420312046524f4d2070675f636c61737320630a20204a4f494e2070675f6e616d657370616365206e204f4e206e2e6f6964203d20632e72656c6e616d6573706163650a20205748455245206e2e6e73706e616d65203d20277075626c69632720414e4420632e72656c6e616d65203d202775736572270a29";
const goldenChecksum = "sha256/94ed9b803f3f1aab13781edaf6ffbba94834295dce1ca5a64ac5135bd5998505";

describe("canonical migration checksums", () => {
	test("matches the Swift canonical encoding golden vector", () => {
		expect(bytesToHex(canonicalEncode([operation]))).toBe(canonicalHex);
	});

	test("matches the Swift checksum golden vector", async () => {
		expect(await checksum([operation])).toBe(goldenChecksum);
	});

	test("encodes UTF-8 byte lengths rather than UTF-16 code units", () => {
		const encoded = canonicalEncode([{ ...operation, id: "é" }]);
		expect(bytesToHex(encoded)).toContain("00000002c3a9");
	});

	test("preserves operation order and outsideTransaction", async () => {
		const second = { ...operation, id: "table.second", outsideTransaction: true };
		expect(await checksum([operation, second])).not.toBe(await checksum([second, operation]));
		expect(await checksum([operation])).not.toBe(
			await checksum([{ ...operation, outsideTransaction: true }]),
		);
	});

	test("encodes empty operation arrays", async () => {
		expect(bytesToHex(canonicalEncode([]))).toBe(
			"000000106d6967726174726f6d2f6f70732f763100000000",
		);
		expect(await checksum([])).toMatch(/^sha256\/[0-9a-f]{64}$/);
	});

	test("parses and verifies checksums case-insensitively", async () => {
		expect(parseChecksum(goldenChecksum)).toEqual({
			algo: "sha256",
			hex: goldenChecksum.split("/")[1]!,
		});
		const uppercaseHex = `sha256/${goldenChecksum.split("/")[1]!.toUpperCase()}`;
		await expect(verifyChecksum(uppercaseHex, [operation], 1)).resolves.toBeUndefined();
	});

	test("rejects malformed and unknown checksums", async () => {
		expect(() => parseChecksum("sha256")).toThrow(ConfigError);
		expect(() => parseChecksum("sha256/not-hex")).toThrow(ConfigError);
		await expect(verifyChecksum("unknown/deadbeef", [operation], 1)).rejects.toThrow(ConfigError);
	});

	test("rejects edited operations with complete checksum strings", async () => {
		const edited = { ...operation, label: `${operation.label} ` };
		try {
			await verifyChecksum(goldenChecksum, [edited], 7);
			throw new Error("expected verification to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(MigrationChecksumMismatchError);
			const mismatch = error as MigrationChecksumMismatchError;
			expect(mismatch.expected).toBe(goldenChecksum);
			expect(mismatch.actual).toMatch(/^sha256\/[0-9a-f]{64}$/);
		}
	});
});
