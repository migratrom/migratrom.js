import type { Operation } from "../types.ts";
import { enumLabelExistsSql, enumTypeExistsSql } from "../sql/catalog.ts";
import { qualified, quoteLiteral } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export interface AddEnumValueOptions {
	before?: string;
}

export function addEnumValue(
	schema: string,
	typeName: string,
	value: string,
	options?: AddEnumValueOptions,
): Operation {
	const beforeClause = options?.before ? ` BEFORE ${quoteLiteral(options.before)}` : "";
	const alterSql = `ALTER TYPE ${qualified(schema, typeName)} ADD VALUE ${quoteLiteral(value)}${beforeClause}`;

	return {
		id: `enum.${typeName}.${value}`,
		label: `Add enum value "${value}" to type "${typeName}"`,
		precheck: [
			check(`ensure enum type "${typeName}" exists`, enumTypeExistsSql(schema, typeName, false)),
			check(
				`ensure enum value "${value}" does not exist on "${typeName}"`,
				enumLabelExistsSql(schema, typeName, value, true),
			),
		],
		execute: [step(`add enum value "${value}" to "${typeName}"`, alterSql)],
		postcheck: [
			check(
				`verify enum value "${value}" exists on "${typeName}"`,
				enumLabelExistsSql(schema, typeName, value, false),
			),
		],
	};
}
