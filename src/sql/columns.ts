import type { ColumnDef } from "../types.ts";
import { quoteIdent } from "./identifiers.ts";

/** Render one column line: "name" type [DEFAULT ...] [NOT NULL]. */
export function renderColumnDef(col: ColumnDef): string {
	const parts = [quoteIdent(col.name), col.typeSql];
	if (col.defaultSql) parts.push(col.defaultSql);
	if (!col.nullable) parts.push("NOT NULL");
	return parts.join(" ");
}

/** Comma-joined column definition lines. */
export function renderColumnList(columns: ColumnDef[]): string {
	return columns.map(renderColumnDef).join(",\n  ");
}
