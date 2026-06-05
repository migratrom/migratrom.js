import { describe, expect, test } from "bun:test";
import {
	addColumn,
	addUnique,
	createIndex,
	createSchema,
	createTable,
	setColumnDefault,
} from "../src/index.ts";
import { UnsupportedFeatureError } from "../src/errors.ts";
import { PostgresDialect, SQLiteDialect } from "../src/sql/dialect.ts";

describe("SQL dialects", () => {
	test("Postgres history DDL and table SQL remain unchanged", () => {
		const dialect = new PostgresDialect();
		expect(dialect.createHistoryTableSql("__migratron_history__")).toContain("timestamptz");
		expect(
			createTable("public", "user", [{ name: "id", typeSql: "bigint" }], dialect, {
				columns: ["id"],
			}).execute[0]?.sql,
		).toBe(`CREATE TABLE "public"."user" (
  "id" bigint NOT NULL,
  PRIMARY KEY ("id")
)`);
	});

	test("SQLite emits supported table, column, and index SQL", () => {
		const dialect = new SQLiteDialect();
		const table = createTable(
			"main",
			"users",
			[
				{ name: "id", typeSql: "INTEGER" },
				{ name: "email", typeSql: "TEXT" },
			],
			dialect,
			{ columns: ["id"] },
		);
		expect(table.execute[0]?.sql).toBe(`CREATE TABLE "main"."users" (
  "id" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  PRIMARY KEY ("id")
)`);
		expect(table.precheck[0]?.sql).toContain('"main".sqlite_master');

		expect(
			addColumn("main", "users", { name: "name", typeSql: "TEXT", nullable: true }, dialect)
				.execute[0]?.sql,
		).toBe('ALTER TABLE "main"."users" ADD COLUMN "name" TEXT');

		expect(
			createIndex("main", "users", "users_email_idx", ["email"], dialect).execute[0]?.sql,
		).toBe('CREATE INDEX "main"."users_email_idx" ON "users" ("email")');
	});

	test("SQLite history DDL uses SQLite types", () => {
		const sql = new SQLiteDialect().createHistoryTableSql("__migratron_history__");
		expect(sql).toContain("INTEGER PRIMARY KEY");
		expect(sql).toContain("DEFAULT CURRENT_TIMESTAMP");
		expect(sql).not.toContain("timestamptz");
	});

	test("SQLite rejects unsupported builders before execution", () => {
		const dialect = new SQLiteDialect();
		expect(() => createSchema("app", dialect)).toThrow(UnsupportedFeatureError);
		expect(() => addUnique("main", "users", "users_email_key", ["email"], dialect)).toThrow(
			UnsupportedFeatureError,
		);
		expect(() => setColumnDefault("main", "users", "email", "DEFAULT ''", dialect)).toThrow(
			UnsupportedFeatureError,
		);
		expect(() =>
			createIndex("main", "users", "users_email_idx", ["email"], dialect, {
				concurrently: true,
			}),
		).toThrow(UnsupportedFeatureError);
	});
});
