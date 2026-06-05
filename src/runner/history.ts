import { canonicalEncode } from "../checksum/canonicalEncoding.ts";
import { checksum } from "../checksum/checksum.ts";
import type { Db, Migration, SQLDialect } from "../types.ts";
import { bytesToHex } from "../utilities/encoding/bytes.ts";

const DEFAULT_HISTORY_TABLE = "__migratron_history__";

export function defaultHistoryTable(): string {
	return DEFAULT_HISTORY_TABLE;
}

export interface AppliedMigrationRecord {
	checksum: string;
	/** Canonical operation-encoding hex stored at apply time. */
	operations: string | null;
}

export async function ensureHistoryTable(db: Db, name: string, dialect: SQLDialect): Promise<void> {
	await db.execute(dialect.createHistoryTableSql(name));
}

export async function readAppliedIds(
	db: Db,
	name: string,
	dialect: SQLDialect,
): Promise<Set<number>> {
	const q = dialect.quoteIdent(name);
	const rows = await db.queryRows<{ id: number | string }>(`SELECT id FROM ${q}`);
	const set = new Set<number>();
	for (const row of rows) set.add(Number(row.id));
	return set;
}

export async function readAppliedRecords(
	db: Db,
	name: string,
	dialect: SQLDialect,
): Promise<Map<number, AppliedMigrationRecord>> {
	const q = dialect.quoteIdent(name);
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

export async function recordMigration(
	db: Db,
	name: string,
	migration: Migration,
	dialect: SQLDialect,
): Promise<void> {
	const operationsHex = bytesToHex(canonicalEncode(migration.operations));
	const digest = await checksum(migration.operations);
	const q = dialect.quoteIdent(name);
	const parent = migration.parentId === null ? "NULL" : String(migration.parentId);
	await db.execute(
		`INSERT INTO ${q} (id, parent_id, checksum, operations) VALUES (${migration.id}, ${parent}, ${dialect.quoteLiteral(digest)}, ${dialect.quoteLiteral(operationsHex)})`,
	);
}
