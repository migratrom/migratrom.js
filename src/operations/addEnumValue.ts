import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/** Options for {@link addEnumValue}. */
export interface AddEnumValueOptions {
	/** Insert the new label before this existing enum value (`ADD VALUE ... BEFORE`). */
	before?: string;
}

/**
 * Append (or insert) a label on an existing `ENUM` type.
 *
 * PostgreSQL cannot remove enum values; plan label additions as forward-only
 * changes. When `before` is omitted, the value is appended at the end.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param typeName - Existing enum type name.
 * @param value - New enum label.
 * @param options - Optional placement relative to an existing label.
 * @returns An idempotent operation that skips when the label already exists.
 */
export function addEnumValue(
	schema: string,
	typeName: string,
	value: string,
	dialect: SQLDialect,
	options?: AddEnumValueOptions,
): Operation {
	requireCapability(dialect, "enumTypes", "enum values");
	const beforeClause = options?.before ? ` BEFORE ${dialect.quoteLiteral(options.before)}` : "";
	const alterSql = `ALTER TYPE ${dialect.qualified(schema, typeName)} ADD VALUE ${dialect.quoteLiteral(value)}${beforeClause}`;

	return {
		id: `enum.${typeName}.${value}`,
		label: `Add enum value "${value}" to type "${typeName}"`,
		precheck: [
			check(
				`ensure enum type "${typeName}" exists`,
				dialect.enumTypeExistsSql(schema, typeName, false),
			),
			check(
				`ensure enum value "${value}" does not exist on "${typeName}"`,
				dialect.enumLabelExistsSql(schema, typeName, value, true),
			),
		],
		execute: [step(`add enum value "${value}" to "${typeName}"`, alterSql)],
		postcheck: [
			check(
				`verify enum value "${value}" exists on "${typeName}"`,
				dialect.enumLabelExistsSql(schema, typeName, value, false),
			),
		],
	};
}
