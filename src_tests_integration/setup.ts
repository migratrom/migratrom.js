import { beforeEach } from "bun:test";
import { resetTestDb } from "./psql.ts";

beforeEach(async () => {
	await resetTestDb();
});
