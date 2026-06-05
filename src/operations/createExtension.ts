import type { Operation, SQLDialect } from "../types.ts";
import { check, requireCapability, step } from "./helpers.ts";

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
export function createExtension(
	name: string,
	dialect: SQLDialect,
	options?: CreateExtensionOptions,
): Operation {
	requireCapability(dialect, "extensions", "extensions");
	const withSchema = options?.schema ? ` WITH SCHEMA ${dialect.quoteIdent(options.schema)}` : "";
	const createSql = `CREATE EXTENSION ${dialect.quoteIdent(name)}${withSchema}`;

	return {
		id: `extension.${name}`,
		label: `Create extension "${name}"`,
		precheck: [
			check(`ensure extension "${name}" does not exist`, dialect.extensionExistsSql(name, true)),
		],
		execute: [step(`create extension "${name}"`, createSql)],
		postcheck: [
			check(`verify extension "${name}" exists`, dialect.extensionExistsSql(name, false)),
		],
	};
}
