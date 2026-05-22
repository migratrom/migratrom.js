import { $ } from "bun";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createTestDatabase, dropTestDatabase } from "./psql.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const TEST_FILES = readdirSync(join(REPO_ROOT, "src_tests_integration"))
	.filter((name) => name.endsWith(".test.ts"))
	.map((name) => join("src_tests_integration", name));

async function main(): Promise<number> {
	try {
		await createTestDatabase();
	} catch (err) {
		console.error("integration harness: failed to create test database");
		console.error(err instanceof Error ? err.message : err);
		console.error("requires Postgres on 127.0.0.1:5432, user postgres (no password), psql on PATH");
		return 1;
	}

	let exitCode = 1;
	try {
		// One worker: all files share a single Postgres database reset in setup.ts beforeEach.
		const result = await $`bun test ${TEST_FILES} --max-concurrency=1 --parallel=1`
			.cwd(REPO_ROOT)
			.nothrow();
		exitCode = result.exitCode;
	} finally {
		try {
			await dropTestDatabase();
		} catch (err) {
			console.error("integration harness: failed to drop test database");
			console.error(err instanceof Error ? err.message : err);
			exitCode = exitCode === 0 ? 1 : exitCode;
		}
	}

	return exitCode;
}

const code = await main();
process.exit(code);
