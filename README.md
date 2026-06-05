# migratrom

Declarative, self-verifying PostgreSQL and SQLite schema migrations for Bun,
Node, and Deno.

The core is driver-independent. SQL generation and feature support are selected
explicitly with `PostgresDialect` or `SQLiteDialect`.

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

Install the optional driver used by your database:

```bash
bun add postgres # PostgreSQL
bun add libsql   # local or in-memory SQLite
```

## Usage

```ts
import { applyMigrations, createTable, addUnique, addColumn, PostgresDialect } from "migratrom";
import { postgresAdapter } from "migratrom/adapters/postgres";
import type { Migration } from "migratrom";
import postgres from "postgres";

const dialect = new PostgresDialect();

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
			dialect,
			{ columns: ["id"] },
		),
		addUnique("public", "user", "user_email_key", ["email"], dialect),
	],
};

const M2: Migration = {
	id: 2391,
	parentId: 2390,
	operations: [
		addColumn("public", "user", { name: "password_hash", typeSql: "text" }, dialect),
		addColumn(
			"public",
			"user",
			{
				name: "role",
				typeSql: "text",
				defaultSql: "DEFAULT 'user'",
			},
			dialect,
		),
		addColumn(
			"public",
			"user",
			{
				name: "created_at",
				typeSql: "TIMESTAMP WITH TIME ZONE",
				defaultSql: "DEFAULT CURRENT_TIMESTAMP",
			},
			dialect,
		),
		addColumn(
			"public",
			"user",
			{
				name: "updated_at",
				typeSql: "TIMESTAMP WITH TIME ZONE",
				defaultSql: "DEFAULT CURRENT_TIMESTAMP",
			},
			dialect,
		),
	],
};

const sql = postgres(process.env.DATABASE_URL!);
await applyMigrations([M, M2], { db: postgresAdapter(sql), dialect });
```

## SQLite

The bundled SQLite adapter targets the cross-runtime `libsql` package:

```ts
import Database from "libsql";
import { applyMigrations, createIndex, createTable, SQLiteDialect } from "migratrom";
import { libsqlAdapter } from "migratrom/adapters/sqlite";

const database = new Database("app.sqlite");
const db = libsqlAdapter(database);
const dialect = new SQLiteDialect();

const migration: Migration = {
	id: 1,
	parentId: null,
	operations: [
		createTable(
			"main",
			"users",
			[
				{ name: "id", typeSql: "INTEGER" },
				{ name: "email", typeSql: "TEXT" },
			],
			dialect,
			{ columns: ["id"] },
		),
		createIndex("main", "users", "users_email_idx", ["email"], dialect),
	],
};

await applyMigrations([migration], { db, dialect });
database.close();
```

SQLite supports table creation with inline constraints, adding columns,
non-concurrent indexes, views, table/column renames, and `rawSql`. Builders for
PostgreSQL-only features throw `UnsupportedFeatureError`.
