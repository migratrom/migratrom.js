import { parseCheckRows, parseScalarRows } from "./queryResult.ts";
import { createTxContext } from "./txContext.ts";
import type { Db } from "../types.ts";

export interface FakeDbOptions {
	boolResults?: Map<string, boolean>;
	scalarResults?: Map<string, unknown>;
}

export class FakeDb implements Db {
	executed: string[] = [];
	private boolResults: Map<string, boolean>;
	private scalarResults: Map<string, unknown>;
	private readonly txCtx = createTxContext<FakeDb>();
	private transactionRolledBack = false;

	constructor(options: FakeDbOptions = {}) {
		this.boolResults = options.boolResults ?? new Map();
		this.scalarResults = options.scalarResults ?? new Map();
	}

	setBool(sql: string, value: boolean): void {
		this.boolResults.set(sql, value);
	}

	async queryBool(sql: string): Promise<boolean> {
		const scripted = this.boolResults.get(sql);
		if (scripted !== undefined) return scripted;
		return parseCheckRows([{ result: false }]);
	}

	async execute(sql: string): Promise<void> {
		this.executed.push(sql);
	}

	async queryScalar<T>(sql: string): Promise<T | undefined> {
		const scripted = this.scalarResults.get(sql);
		if (scripted !== undefined) return scripted as T;
		return parseScalarRows<T>([]);
	}

	rowResults: unknown[] = [];

	async queryRows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
		void sql;
		return this.rowResults as T[];
	}

	async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
		if (this.txCtx.getActive()) return fn();
		const snapshot = [...this.executed];
		this.transactionRolledBack = false;
		try {
			return await this.txCtx.run(this, fn);
		} catch (err) {
			this.transactionRolledBack = true;
			this.executed = snapshot;
			throw err;
		}
	}

	wasRolledBack(): boolean {
		return this.transactionRolledBack;
	}
}
