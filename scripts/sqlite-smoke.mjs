import Database from "libsql";
import { applyMigrations, createTable, SQLiteDialect } from "../dist/index.js";
import { libsqlAdapter } from "../dist/adapters/sqlite.js";

const database = new Database(":memory:");
const db = libsqlAdapter(database);
const dialect = new SQLiteDialect();

const result = await applyMigrations(
	[
		{
			id: 1,
			parentId: null,
			operations: [
				createTable("main", "smoke", [{ name: "id", typeSql: "INTEGER" }], dialect, {
					columns: ["id"],
				}),
			],
		},
	],
	{ db, dialect },
);

if (
	result.applied.length !== 1 ||
	!(await db.queryBool(
		"SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'smoke')",
	))
) {
	throw new Error("SQLite smoke migration failed");
}

database.close();
