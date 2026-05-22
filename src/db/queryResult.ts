import { CheckShapeError } from "../errors.ts";

export function previewRow(rows: unknown[]): string | undefined {
	if (rows.length === 0) return undefined;
	try {
		const s = JSON.stringify(rows[0]);
		return s.length > 200 ? `${s.slice(0, 200)}…` : s;
	} catch {
		return String(rows[0]);
	}
}

function readOneColumn(row: unknown, rows: unknown[]): unknown {
	if (row === null || typeof row !== "object" || Array.isArray(row)) {
		throw new CheckShapeError("row must be an object", { rowPreview: previewRow(rows) });
	}
	const values = Object.values(row as Record<string, unknown>);
	if (values.length !== 1) {
		throw new CheckShapeError(`must return exactly one column, got ${values.length}`, {
			rowPreview: previewRow(rows),
		});
	}
	return values[0];
}

/** Decode rows from a Check query (must be one boolean). */
export function parseCheckRows(rows: unknown[]): boolean {
	if (rows.length !== 1) {
		throw new CheckShapeError(`check must return exactly one row, got ${rows.length}`, {
			rowPreview: previewRow(rows),
		});
	}
	const val = readOneColumn(rows[0], rows);
	if (typeof val !== "boolean") {
		throw new CheckShapeError(`check must return a boolean, got ${typeof val}`, {
			rowPreview: previewRow(rows),
		});
	}
	return val;
}

/**
 * Decode rows from a scalar query.
 * - 0 rows → undefined (legitimate empty)
 * - 1 row → single column value
 * - wrong shape → CheckShapeError
 */
export function parseScalarRows<T>(rows: unknown[]): T | undefined {
	if (rows.length === 0) return undefined;
	if (rows.length !== 1) {
		throw new CheckShapeError(`scalar must return at most one row, got ${rows.length}`, {
			rowPreview: previewRow(rows),
		});
	}
	return readOneColumn(rows[0], rows) as T;
}
