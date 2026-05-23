import type { Operation } from "../types.ts";
import { extensionExistsSql } from "../sql/catalog.ts";
import { quoteIdent } from "../sql/identifiers.ts";
import { check, step } from "./helpers.ts";

/** Options for {@link createExtension}. */
export interface CreateExtensionOptions {
	/** Install the extension into this schema (`CREATE EXTENSION ... WITH SCHEMA`). */
	schema?: string;
}

/**
 * Install a PostgreSQL extension (e.g. `"uuid-ossp"`, `"pgcrypto"`).
 *
 * Requires sufficient database privileges and a compatible server build.
 *
 * @param name - Extension name as accepted by `CREATE EXTENSION`.
 * @param options - Optional target schema for extension objects.
 * @returns An idempotent operation that skips when the extension already exists.
 */
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
