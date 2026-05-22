# migratrom

PostgreSQL schema migrations for Bun, Node, and Deno. Migrations are plain TypeScript objects with idempotent, self-verifying operations.

## Operations

| Operation                | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `createTable`            | Create a table with columns and optional primary key |
| `addColumn`              | Add a column to an existing table                    |
| `setColumnDefault`       | Set a column default on an existing table            |
| `setColumnNotNull`       | Set a column to NOT NULL                             |
| `renameColumn`           | Rename a column                                      |
| `renameTable`            | Rename a table                                       |
| `addUnique`              | Add a UNIQUE constraint                              |
| `addCheck`               | Add a CHECK constraint                               |
| `addPrimaryKey`          | Add a PRIMARY KEY constraint                         |
| `addForeignKey`          | Add a foreign key                                    |
| `createIndex`            | Create an index (optional `CONCURRENTLY`)            |
| `createSchema`           | Create a schema                                      |
| `createExtension`        | Create an extension                                  |
| `createSequence`         | Create a sequence                                    |
| `createType`             | Create an ENUM type                                  |
| `addEnumValue`           | Add a value to an ENUM type                          |
| `createView`             | Create a view                                        |
| `createMaterializedView` | Create a materialized view                           |
| `rawSql`                 | Arbitrary DDL with custom checks                     |
| `applyMigrations`        | Run pending migrations                               |

## Install

```bash
bun add migratrom
# or
npm install migratrom
```

`postgres` is only required when using `migratrom/adapters/postgres`.

## Usage

```ts
import { applyMigrations, createTable, addUnique, addColumn } from "migratrom";
import { postgresAdapter } from "migratrom/adapters/postgres";
import type { Migration } from "migratrom";
import postgres from "postgres";

const M: Migration = {
	id: 2390,
	parentId: null,
	operations: [
		createTable(
			"public",
			"user",
			[
				{ name: "id", typeSql: "SERIAL" },
				{ name: "email", typeSql: "text" },
			],
			{ columns: ["id"] },
		),
		addUnique("public", "user", "user_email_key", ["email"]),
	],
};

const M2: Migration = {
	id: 2391,
	parentId: 2390,
	operations: [
		addColumn("public", "user", { name: "password_hash", typeSql: "text" }),
		addColumn("public", "user", {
			name: "role",
			typeSql: "text",
			defaultSql: "DEFAULT 'user'",
		}),
		addColumn("public", "user", {
			name: "created_at",
			typeSql: "TIMESTAMP WITH TIME ZONE",
			defaultSql: "DEFAULT CURRENT_TIMESTAMP",
		}),
		addColumn("public", "user", {
			name: "updated_at",
			typeSql: "TIMESTAMP WITH TIME ZONE",
			defaultSql: "DEFAULT CURRENT_TIMESTAMP",
		}),
	],
};

const sql = postgres(process.env.DATABASE_URL!);
await applyMigrations([M, M2], { db: postgresAdapter(sql) });
```
