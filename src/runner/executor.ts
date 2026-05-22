import {
	CheckShapeError,
	EmptyPostcheckError,
	PostcheckFailedError,
	PrecheckFailedError,
} from "../errors.ts";
import type { Check, Db, Logger, Operation } from "../types.ts";

async function evalChecks(db: Db, operationId: string, checks: Check[]): Promise<boolean[]> {
	const results: boolean[] = [];
	for (const c of checks) {
		try {
			results.push(await db.queryBool(c.sql));
		} catch (err) {
			if (err instanceof CheckShapeError) {
				throw err.withContext({
					operationId,
					description: c.description,
					sql: c.sql,
				});
			}
			throw err;
		}
	}
	return results;
}

export interface RunOperationOptions {
	dryRun?: boolean;
}

export async function runOperation(
	db: Db,
	op: Operation,
	log: Logger,
	options?: RunOperationOptions,
): Promise<"executed" | "skipped"> {
	const dryRun = options?.dryRun ?? false;
	if (op.postcheck.length === 0) {
		throw new EmptyPostcheckError(op.id);
	}

	const postResults = await evalChecks(db, op.id, op.postcheck);
	if (postResults.every(Boolean)) {
		log.info(`skip operation ${op.id} (already applied)`);
		return "skipped";
	}

	const preResults = await evalChecks(db, op.id, op.precheck);
	for (let i = 0; i < op.precheck.length; i++) {
		const check = op.precheck[i];
		if (!preResults[i]) {
			throw new PrecheckFailedError(op.id, check!);
		}
	}

	if (!dryRun) {
		for (const step of op.execute) {
			await db.execute(step.sql);
		}
	} else {
		log.info(`dry-run would execute operation ${op.id}`);
	}

	if (dryRun) return "executed";

	const verifyResults = await evalChecks(db, op.id, op.postcheck);
	for (let i = 0; i < op.postcheck.length; i++) {
		const check = op.postcheck[i];
		if (!verifyResults[i]) {
			throw new PostcheckFailedError(op.id, check!);
		}
	}

	log.info(`executed operation ${op.id}`);
	return "executed";
}
