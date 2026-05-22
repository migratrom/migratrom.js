import type { Operation } from "../types.ts";
import { extensionExistsSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

export interface CreateExtensionOptions {
	schema?: string;
}

export function createExtension(name: string, options?: CreateExtensionOptions): Operation {
	const withSchema = options?.schema ? ` WITH SCHEMA ${quoteIdent(options.schema)}` : "";
	const createSql = `CREATE EXTENSION ${quoteIdent(name)}${withSchema}`;

	return {
		id: `extension.${name}`,
		label: `Create extension "${name}"`,
		precheck: [check(`ensure extension "${name}" does not exist`, extensionExistsSql(name, true))],
		execute: [step(`create extension "${name}"`, createSql)],
		postcheck: [check(`verify extension "${name}" exists`, extensionExistsSql(name, false))],
	};
}
