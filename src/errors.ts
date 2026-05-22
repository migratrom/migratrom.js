import type { Check } from "./types.ts";

export class MigratromError extends Error {}

export class DuplicateMigrationIdError extends MigratromError {
	constructor(public id: number) {
		super(`duplicate migration id: ${id}`);
		this.name = new.target.name;
	}
}

export class MissingParentError extends MigratromError {
	constructor(
		public id: number,
		public parentId: number,
	) {
		super(`migration ${id} references missing parent ${parentId}`);
		this.name = new.target.name;
	}
}

export class MissingRootError extends MigratromError {
	constructor() {
		super("no root migration (parentId === null) in an empty history");
		this.name = new.target.name;
	}
}

export class MultipleRootsError extends MigratromError {
	constructor(public rootIds: number[]) {
		super(`multiple root migrations: ${rootIds.join(", ")}`);
		this.name = new.target.name;
	}
}

export class CycleDetectedError extends MigratromError {
	constructor(public cycle: number[]) {
		super(`cycle detected in migration graph: ${cycle.join(" -> ")}`);
		this.name = new.target.name;
	}
}

export class PrecheckFailedError extends MigratromError {
	constructor(
		public operationId: string,
		public check: Check,
	) {
		super(`precheck failed for operation "${operationId}": ${check.description}`);
		this.name = new.target.name;
	}
}

export class PostcheckFailedError extends MigratromError {
	constructor(
		public operationId: string,
		public check: Check,
	) {
		super(`postcheck failed for operation "${operationId}": ${check.description}`);
		this.name = new.target.name;
	}
}

export class MigrationFailedError extends MigratromError {
	constructor(
		public migrationId: number,
		public override cause: unknown,
	) {
		const detail = cause instanceof Error ? `: ${cause.message}` : "";
		super(`migration ${migrationId} failed${detail}`);
		this.name = new.target.name;
	}
}

export class MigrationChecksumMismatchError extends MigratromError {
	constructor(
		public migrationId: number,
		public expected: string,
		public actual: string,
	) {
		super(
			`migration ${migrationId} checksum mismatch (applied body was edited): expected ${expected}, got ${actual}`,
		);
		this.name = new.target.name;
	}
}

export class ConfigError extends MigratromError {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class EmptyPostcheckError extends MigratromError {
	constructor(public operationId: string) {
		super(`operation "${operationId}" has no postcheck`);
		this.name = new.target.name;
	}
}

export interface CheckShapeContext {
	sql?: string;
	description?: string;
	operationId?: string;
	rowPreview?: string;
}

function formatCheckShapeMessage(message: string, ctx?: CheckShapeContext): string {
	const parts = [message];
	if (ctx?.operationId) parts.push(`operation "${ctx.operationId}"`);
	if (ctx?.description) parts.push(ctx.description);
	if (ctx?.sql) parts.push(`sql: ${ctx.sql}`);
	if (ctx?.rowPreview) parts.push(`row: ${ctx.rowPreview}`);
	return parts.join(" — ");
}

export class CheckShapeError extends MigratromError {
	readonly baseMessage: string;
	readonly sql?: string;
	readonly description?: string;
	readonly operationId?: string;
	readonly rowPreview?: string;

	constructor(baseMessage: string, context?: CheckShapeContext) {
		super(formatCheckShapeMessage(baseMessage, context));
		this.name = new.target.name;
		this.baseMessage = baseMessage;
		this.sql = context?.sql;
		this.description = context?.description;
		this.operationId = context?.operationId;
		this.rowPreview = context?.rowPreview;
	}

	withContext(extra: CheckShapeContext): CheckShapeError {
		return new CheckShapeError(this.baseMessage, {
			sql: extra.sql ?? this.sql,
			description: extra.description ?? this.description,
			operationId: extra.operationId ?? this.operationId,
			rowPreview: extra.rowPreview ?? this.rowPreview,
		});
	}
}
