import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

/**
 * Create a PostgreSQL `ENUM` type with the given labels.
 *
 * Label order is preserved. Add later values with {@link addEnumValue}.
 *
 * @param schema - PostgreSQL schema, e.g. `"public"`.
 * @param name - Unqualified enum type name.
 * @param labels - Enum member strings, in declaration order.
 * @returns An idempotent operation that skips when the type already exists.
 */
export function createType(
	schema: string,
	name: string,
	labels: string[],
	dialect: SQLDialect,
): Operation {
	requireCapability(dialect, "enumTypes", "enum types");
	const labelList = labels.map((label) => dialect.quoteLiteral(label)).join(", ");
	const createSql = `CREATE TYPE ${dialect.qualified(schema, name)} AS ENUM (${labelList})`;

	return {
		id: `type.${name}`,
		label: `Create enum type "${name}"`,
		precheck: [
			check(`ensure type "${name}" does not exist`, dialect.enumTypeExistsSql(schema, name, true)),
		],
		execute: [step(`create enum type "${name}"`, createSql)],
		postcheck: [
			check(`verify type "${name}" exists`, dialect.enumTypeExistsSql(schema, name, false)),
		],
	};
}
