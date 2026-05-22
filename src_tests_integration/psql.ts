import { $ } from "bun";
import { join } from "node:path";
import { ADMIN_DB, PG_HOST, PG_PORT, PG_USER, TEST_DB } from "./constants.ts";

const SQL_DIR = join(import.meta.dir, "sql");

type PsqlTarget = typeof ADMIN_DB | typeof TEST_DB;

export async function runPsql(
	targetDb: PsqlTarget,
	opts: { file?: string; command?: string },
): Promise<void> {
	const result = opts.file
		? await $`psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${targetDb} -v ON_ERROR_STOP=1 -f ${join(SQL_DIR, opts.file)}`
				.quiet()
				.nothrow()
		: await $`psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${targetDb} -v ON_ERROR_STOP=1 -c ${opts.command!}`
				.quiet()
				.nothrow();

	if (result.exitCode !== 0) {
		const detail =
			result.stderr.toString().trim() ||
			result.stdout.toString().trim() ||
			`exit ${result.exitCode}`;
		throw new Error(`psql failed (${targetDb}): ${detail}`);
	}
}

export async function createTestDatabase(): Promise<void> {
	await runPsql(ADMIN_DB, { file: "drop_db.sql" });
	await runPsql(ADMIN_DB, { file: "create_db.sql" });
}

export async function dropTestDatabase(): Promise<void> {
	await runPsql(ADMIN_DB, { file: "drop_db.sql" });
}

export async function resetTestDb(): Promise<void> {
	await runPsql(TEST_DB, { file: "reset.sql" });
}
