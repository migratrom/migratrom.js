/** A boolean-returning SQL probe. Must yield one row / one column / boolean. */
export interface Check {
	/** Human-readable intent, e.g. 'ensure table "user" does not exist'. */
	description: string;
	sql: string;
}

/** A side-effecting DDL/DML statement. */
export interface ExecuteStep {
	description: string;
	sql: string;
}

/** A single, named, self-verifying unit of change. */
export interface Operation {
	/** Stable logical id, e.g. "table.user", "fk.post.post_authorId_fkey". */
	id: string;
	/** Human-readable label, e.g. 'Create table "user"'. */
	label: string;
	precheck: Check[];
	execute: ExecuteStep[];
	postcheck: Check[];
	/**
	 * When true, run outside the per-migration transaction (required for
	 * `CREATE INDEX CONCURRENTLY`, which cannot run inside a transaction).
	 */
	outsideTransaction?: boolean;
}

export interface CreateIndexOptions {
	/** Emit `CREATE INDEX CONCURRENTLY` and run outside the migration transaction. */
	concurrently?: boolean;
}

export interface ColumnDef {
	name: string;
	/** Raw SQL type, authored by the developer. Emitted verbatim. e.g. "text". */
	typeSql: string;
	/** Defaults to false (=> column rendered NOT NULL). */
	nullable?: boolean;
	/** Full default clause INCLUDING the DEFAULT keyword, e.g. "DEFAULT (now())". */
	defaultSql?: string;
}

export interface PrimaryKey {
	columns: string[];
}

export interface ForeignKeySpec {
	name: string;
	columns: string[];
	references: { table: string; columns: string[] };
	onDelete?: "CASCADE" | "RESTRICT" | "SET NULL" | "NO ACTION" | "SET DEFAULT";
	onUpdate?: "CASCADE" | "RESTRICT" | "SET NULL" | "NO ACTION" | "SET DEFAULT";
}

export interface Migration {
	readonly id: number;
	readonly parentId: number | null;
	readonly operations: Operation[];
}

export interface ApplyOptions {
	/** Driver-agnostic DB handle. Build via an adapter, e.g. postgresAdapter(sql). */
	db: Db;
	/** Override history table name. Default "__migratron_history__". */
	historyTable?: string;
	/** Build & log the plan, run prechecks read-only, but execute nothing. */
	dryRun?: boolean;
	/** Optional structured logger; defaults to a console-based one. */
	logger?: Logger;
}

/**
 * The ONLY contract the library core has with a database. Adapters implement
 * it; the core imports no driver.
 */
export interface Db {
	/** Run a boolean Check; assert single row/col boolean, else throw. */
	queryBool(sql: string): Promise<boolean>;
	/** Run a side-effecting statement (DDL/DML). */
	execute(sql: string): Promise<void>;
	/** Run a scalar query returning the first column of the first row. */
	queryScalar<T>(sql: string): Promise<T | undefined>;
	/** Run a query returning all rows as objects. */
	queryRows<T extends Record<string, unknown>>(sql: string): Promise<T[]>;
	withTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Logger {
	info(msg: string, meta?: unknown): void;
	warn(msg: string, meta?: unknown): void;
	error(msg: string, meta?: unknown): void;
}

export interface ApplyResult {
	applied: number[];
	skippedOps: string[];
}
