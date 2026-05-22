import postgres from "postgres";
import { postgresAdapter } from "../src/adapters/postgres.ts";
import { TEST_URL } from "./constants.ts";
import type { Db } from "../src/types.ts";

export function connectDb(): { sql: postgres.Sql; db: Db; close: () => Promise<void> } {
	const sql = postgres(TEST_URL);
	return { sql, db: postgresAdapter(sql), close: () => sql.end() };
}
