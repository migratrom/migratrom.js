import { ConfigError, MigrationFailedError } from "../errors.ts";
import { verifyChecksum } from "../checksum/checksum.ts";
import { planOrder } from "../graph/dag.ts";
import type {
	ApplyOptions,
	ApplyResult,
	Db,
	Logger,
	Migration,
	Operation,
	SQLDialect,
} from "../types.ts";
import { sha256 } from "../utilities/hashes/sha.ts";
import { runOperation } from "./executor.ts";
import {
	defaultHistoryTable,
	ensureHistoryTable,
	readAppliedIds,
	readAppliedRecords,
	recordMigration,
} from "./history.ts";
import { consoleLogger } from "./logger.ts";

/**
 * Apply pending migrations in dependency order and record them in the history table.
 *
 * Already-applied migrations are skipped, but their operation payloads are
 * checksum-verified — a changed payload for an applied id throws a checksum
 * mismatch error. Each pending migration runs inside a single transaction unless
 * it contains operations marked
 * {@link Operation.outsideTransaction | outsideTransaction} (e.g.
 * `CREATE INDEX CONCURRENTLY`).
 *
 * Individual operations are idempotent: when a postcheck already passes, the
 * operation is skipped and its id appears in {@link ApplyResult.skippedOps}.
 *
 * @param migrations - Ordered migration graph; use {@link Migration.parentId} to declare dependencies.
 * @param options - Database handle, optional dry-run, logger, and history table name.
 * @returns ids of migrations applied in this run and operation ids skipped as already satisfied.
 *
 * @example
 * ```ts
 * await applyMigrations([M1, M2], { db: postgresAdapter(sql) });
 * await applyMigrations(migrations, { db, dryRun: true }); // plan + prechecks only
 * ```
 */
export async function applyMigrations(
	migrations: Migration[],
	options: ApplyOptions,
): Promise<ApplyResult> {
	if (!options?.db) {
		throw new ConfigError("applyMigrations requires options.db");
	}
	if (!options.dialect) {
		throw new ConfigError("applyMigrations requires options.dialect");
	}

	const advisoryLock = options.advisoryLock ?? true;
	if (advisoryLock && options.dialect.capabilities.advisoryLocks) {
		const runLocked = async (): Promise<ApplyResult> => {
			const key = await advisoryLockKey(options.historyTable ?? defaultHistoryTable());
			await options.dialect.acquireLock(options.db, key);
			try {
				const result = await applyMigrationsUnlocked(migrations, options);
				await options.dialect.releaseLock(options.db, key);
				return result;
			} catch (error) {
				try {
					await options.dialect.releaseLock(options.db, key);
				} catch {
					// Preserve the migration failure.
				}
				throw error;
			}
		};
		return options.db.withConnection ? options.db.withConnection(runLocked) : runLocked();
	}
	return applyMigrationsUnlocked(migrations, options);
}

async function applyMigrationsUnlocked(
	migrations: Migration[],
	options: ApplyOptions,
): Promise<ApplyResult> {
	const db = options.db;
	const dialect = options.dialect;
	const historyTable = options.historyTable ?? defaultHistoryTable();
	const logger = options.logger ?? consoleLogger;
	const dryRun = options.dryRun ?? false;

	await ensureHistoryTable(db, historyTable, dialect);
	const appliedIds = await readAppliedIds(db, historyTable, dialect);
	const storedRecords = await readAppliedRecords(db, historyTable, dialect);

	for (const m of migrations) {
		if (!appliedIds.has(m.id)) continue;
		const stored = storedRecords.get(m.id);
		if (stored === undefined) continue;
		await verifyChecksum(stored.checksum, m.operations, m.id);
	}

	const pending = planOrder(migrations, appliedIds);
	const applied: number[] = [];
	const skippedOps: string[] = [];

	for (const migration of pending) {
		logger.info(`migration ${migration.id}`, { dryRun });
		try {
			const hasOutside = migration.operations.some((o) => o.outsideTransaction);

			if (dryRun) {
				if (hasOutside) {
					await runMigrationOps(migration.operations, db, logger, skippedOps, {
						dryRun: true,
						segmentedTx: true,
						onOp: (op) => logger.info(JSON.stringify(op, null, 2)),
					});
				} else {
					await db
						.withTransaction(async () => {
							await runMigrationOps(migration.operations, db, logger, skippedOps, {
								dryRun: true,
								onOp: (op) => logger.info(JSON.stringify(op, null, 2)),
							});
							throw new DryRunRollback();
						})
						.catch((err) => {
							if (!(err instanceof DryRunRollback)) throw err;
						});
				}
				continue;
			}

			if (hasOutside) {
				await runMigrationOps(migration.operations, db, logger, skippedOps, {
					recordHistory: { table: historyTable, migration, dialect },
				});
			} else {
				await db.withTransaction(async () => {
					await runMigrationOps(migration.operations, db, logger, skippedOps);
					await recordMigration(db, historyTable, migration, dialect);
				});
			}
			applied.push(migration.id);
		} catch (cause) {
			throw new MigrationFailedError(migration.id, cause);
		}
	}

	return { applied, skippedOps };
}

/** First eight SHA-256 bytes interpreted as a signed, big-endian 64-bit integer. */
export async function advisoryLockKey(historyTable: string): Promise<bigint> {
	const bytes = (await sha256(historyTable)).bytes;
	let unsigned = 0n;
	for (const byte of bytes.subarray(0, 8)) {
		unsigned = (unsigned << 8n) | BigInt(byte);
	}
	return unsigned >= 0x8000000000000000n ? unsigned - 0x10000000000000000n : unsigned;
}

async function runMigrationOps(
	operations: Operation[],
	db: Db,
	logger: Logger,
	skippedOps: string[],
	options?: {
		dryRun?: boolean;
		onOp?: (op: Operation) => void;
		segmentedTx?: boolean;
		recordHistory?: { table: string; migration: Migration; dialect: SQLDialect };
	},
): Promise<void> {
	const dryRun = options?.dryRun ?? false;
	const segmented = options?.recordHistory !== undefined || options?.segmentedTx === true;
	const transactional: Operation[] = [];

	const flushTransactional = async (final: boolean): Promise<void> => {
		if (transactional.length === 0) return;
		const batch = transactional.splice(0, transactional.length);

		const body = async (): Promise<void> => {
			for (const op of batch) {
				options?.onOp?.(op);
				const result = await runOperation(db, op, logger, dryRun ? { dryRun: true } : undefined);
				if (result === "skipped") skippedOps.push(op.id);
			}
			if (final && options?.recordHistory) {
				await recordMigration(
					db,
					options.recordHistory.table,
					options.recordHistory.migration,
					options.recordHistory.dialect,
				);
			}
			if (dryRun && segmented) throw new DryRunRollback();
		};

		if (segmented) {
			await db.withTransaction(body).catch((err) => {
				if (!(err instanceof DryRunRollback)) throw err;
			});
			return;
		}
		await body();
	};

	for (const op of operations) {
		if (op.outsideTransaction) {
			await flushTransactional(false);
			options?.onOp?.(op);
			const result = await runOperation(db, op, logger, dryRun ? { dryRun: true } : undefined);
			if (result === "skipped") skippedOps.push(op.id);
			continue;
		}
		transactional.push(op);
	}
	await flushTransactional(true);
}

class DryRunRollback extends Error {
	constructor() {
		super("dry run rollback");
		this.name = "DryRunRollback";
	}
}
