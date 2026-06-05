import { describe, expect, test } from "bun:test";
import { createTable } from "../src/operations/createTable.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

const USER_COLUMNS = [
	{ name: "id", typeSql: "SERIAL" },
	{ name: "email", typeSql: "text" },
	{ name: "name", typeSql: "text", nullable: true },
	{ name: "createdAt", typeSql: "timestamptz", defaultSql: "DEFAULT (now())" },
] as const;

describe("createTable user golden", () => {
	test("matches thoughts.md byte-for-byte", () => {
		const op = createTable("public", "user", [...USER_COLUMNS], dialect, { columns: ["id"] });
		const golden = `{
  "id": "table.user",
  "label": "Create table \\"user\\"",
  "precheck": [
    {
      "description": "ensure table \\"user\\" does not exist",
      "sql": "SELECT to_regclass('\\"public\\".\\"user\\"') IS NULL"
    }
  ],
  "execute": [
    {
      "description": "create table \\"user\\"",
      "sql": "CREATE TABLE \\"public\\".\\"user\\" (\\n  \\"id\\" SERIAL NOT NULL,\\n  \\"email\\" text NOT NULL,\\n  \\"name\\" text,\\n  \\"createdAt\\" timestamptz DEFAULT (now()) NOT NULL,\\n  PRIMARY KEY (\\"id\\")\\n)"
    }
  ],
  "postcheck": [
    {
      "description": "verify table \\"user\\" exists",
      "sql": "SELECT to_regclass('\\"public\\".\\"user\\"') IS NOT NULL"
    }
  ]
}`;
		expect(JSON.stringify(op, null, 2)).toBe(golden);
	});
});

describe("createTable post", () => {
	test("produces expected structure", () => {
		const op = createTable(
			"public",
			"post",
			[
				{ name: "id", typeSql: "SERIAL" },
				{ name: "title", typeSql: "text" },
				{ name: "body", typeSql: "text", nullable: true },
				{ name: "published", typeSql: "bool", defaultSql: "DEFAULT false" },
				{ name: "authorId", typeSql: "int4" },
				{ name: "createdAt", typeSql: "timestamptz", defaultSql: "DEFAULT (now())" },
			],
			dialect,
			{ columns: ["id"] },
		);
		expect(op.id).toBe("table.post");
		expect(op.execute[0]?.sql).toContain('"published" bool DEFAULT false NOT NULL');
		expect(op.execute[0]?.sql).toContain('PRIMARY KEY ("id")');
	});
});
