import { quoteIdent, quoteLiteral } from "../sql/identifiers.ts";
import { stableStringify } from "../utilities/stableJson.ts";
import type { Db, Migration } from "../types.ts";
import { bytesToHex } from "../utilities/encoding/bytes.ts";
import { encodeHashPacket } from "../utilities/hashes/packet.ts";
import { sha256 } from "../utilities/hashes/sha.ts";

const DEFAULT_HISTORY_TABLE = "__migratron_history__";

export function defaultHistoryTable(): string {
	return DEFAULT_HISTORY_TABLE;
}

export interface AppliedMigrationRecord {
	checksum: string;
	/** Serialized operations at apply time; null for rows written before this column existed. */
	operations: string | null;
}

export async function ensureHistoryTable(db: Db, name: string): Promise<void> {
	const q = quoteIdent(name);
	await db.execute(
		`
      CREATE TABLE IF NOT EXISTS ${q} (
        id          bigint PRIMARY KEY,
        parent_id   bigint,
        applied_at  timestamptz NOT NULL DEFAULT now(),
        operations  text NOT NULL,
        checksum    text NOT NULL
      )`.trim(),
	);
}

export async function readAppliedIds(db: Db, name: string): Promise<Set<number>> {
	const q = quoteIdent(name);
	const rows = await db.queryRows<{ id: number | string }>(`SELECT id FROM ${q}`);
	const set = new Set<number>();
	for (const row of rows) set.add(Number(row.id));
	return set;
}

export async function readAppliedRecords(
	db: Db,
	name: string,
): Promise<Map<number, AppliedMigrationRecord>> {
	const q = quoteIdent(name);
	const rows = await db.queryRows<{
		id: number | string;
		checksum: string;
		operations: string | null;
	}>(`SELECT id, checksum, operations FROM ${q}`);
	const map = new Map<number, AppliedMigrationRecord>();
	for (const row of rows) {
		map.set(Number(row.id), {
			checksum: row.checksum,
			operations: row.operations,
		});
	}
	return map;
}

export async function recordMigration(db: Db, name: string, migration: Migration): Promise<void> {
	const payload = stableStringify(migration.operations);
	const digest = await sha256(payload);
	const checksum = bytesToHex(encodeHashPacket("sha256", digest.bytes));
	const q = quoteIdent(name);
	const parent = migration.parentId === null ? "NULL" : String(migration.parentId);
	await db.execute(
		`INSERT INTO ${q} (id, parent_id, checksum, operations) VALUES (${migration.id}, ${parent}, ${quoteLiteral(checksum)}, ${quoteLiteral(payload)})`,
	);
}
