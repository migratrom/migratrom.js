import { describe, expect, test } from "bun:test";
import { addCheck } from "../src/operations/addCheck.ts";
import { addColumn } from "../src/operations/addColumn.ts";
import { addEnumValue } from "../src/operations/addEnumValue.ts";
import { addForeignKey } from "../src/operations/addForeignKey.ts";
import { addPrimaryKey } from "../src/operations/addPrimaryKey.ts";
import { addUnique } from "../src/operations/addUnique.ts";
import { createExtension } from "../src/operations/createExtension.ts";
import { createIndex } from "../src/operations/createIndex.ts";
import { createMaterializedView } from "../src/operations/createMaterializedView.ts";
import { createSchema } from "../src/operations/createSchema.ts";
import { createSequence } from "../src/operations/createSequence.ts";
import { createTable } from "../src/operations/createTable.ts";
import { createType } from "../src/operations/createType.ts";
import { createView } from "../src/operations/createView.ts";
import { rawSql } from "../src/operations/rawSql.ts";
import { renameColumn } from "../src/operations/renameColumn.ts";
import { renameTable } from "../src/operations/renameTable.ts";
import { setColumnDefault } from "../src/operations/setColumnDefault.ts";
import { setColumnNotNull } from "../src/operations/setColumnNotNull.ts";
import { PostgresDialect } from "../src/sql/dialect.ts";

const dialect = new PostgresDialect();

describe("addColumn", () => {
	test("password_hash NOT NULL", () => {
		const op = addColumn("public", "user", { name: "password_hash", typeSql: "text" }, dialect);
		expect(op.id).toBe("column.user.password_hash");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."user" ADD COLUMN "password_hash" text NOT NULL',
		);
		expect(op.precheck[0]?.sql).toContain("information_schema.columns");
		expect(op.precheck[0]?.sql).toContain("NOT EXISTS");
	});

	test("role with default", () => {
		const op = addColumn(
			"public",
			"user",
			{
				name: "role",
				typeSql: "text",
				defaultSql: "DEFAULT 'user'",
			},
			dialect,
		);
		expect(op.execute[0]?.sql).toBe(
			`ALTER TABLE "public"."user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL`,
		);
	});
});

describe("addCheck", () => {
	test("positive_amount", () => {
		const op = addCheck("public", "line", "line_positive_amount", "amount > 0", dialect);
		expect(op.id).toBe("check.line.line_positive_amount");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."line" ADD CONSTRAINT "line_positive_amount" CHECK (amount > 0)',
		);
		expect(op.precheck[0]?.sql).toContain("contype = 'c'");
	});
});

describe("addPrimaryKey", () => {
	test("user_pkey", () => {
		const op = addPrimaryKey("public", "user", "user_pkey", ["id"], dialect);
		expect(op.id).toBe("pk.user.user_pkey");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."user" ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id")',
		);
	});
});

describe("createSchema", () => {
	test("app", () => {
		const op = createSchema("app", dialect);
		expect(op.id).toBe("schema.app");
		expect(op.execute[0]?.sql).toBe('CREATE SCHEMA "app"');
	});
});

describe("createExtension", () => {
	test("plpgsql", () => {
		const op = createExtension("plpgsql", dialect);
		expect(op.id).toBe("extension.plpgsql");
		expect(op.execute[0]?.sql).toBe('CREATE EXTENSION "plpgsql"');
		expect(op.precheck[0]?.sql).toContain("pg_extension");
	});
});

describe("createSequence", () => {
	test("order_seq", () => {
		const op = createSequence("public", "order_seq", dialect);
		expect(op.id).toBe("sequence.order_seq");
		expect(op.execute[0]?.sql).toBe('CREATE SEQUENCE "public"."order_seq"');
	});
});

describe("setColumnDefault", () => {
	test("role default", () => {
		const op = setColumnDefault("public", "user", "role", "DEFAULT 'user'", dialect);
		expect(op.id).toBe("column_default.user.role");
		expect(op.execute[0]?.sql).toBe(
			`ALTER TABLE "public"."user" ALTER COLUMN "role" SET DEFAULT 'user'`,
		);
	});
});

describe("setColumnNotNull", () => {
	test("email", () => {
		const op = setColumnNotNull("public", "user", "email", dialect);
		expect(op.id).toBe("column_not_null.user.email");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."user" ALTER COLUMN "email" SET NOT NULL',
		);
	});
});

describe("renameColumn", () => {
	test("email to email_address", () => {
		const op = renameColumn("public", "user", "email", "email_address", dialect);
		expect(op.id).toBe("rename_column.user.email_to_email_address");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."user" RENAME COLUMN "email" TO "email_address"',
		);
	});
});

describe("renameTable", () => {
	test("user to users", () => {
		const op = renameTable("public", "user", "users", dialect);
		expect(op.id).toBe("rename_table.user_to_users");
		expect(op.execute[0]?.sql).toBe('ALTER TABLE "public"."user" RENAME TO "users"');
	});
});

describe("createType", () => {
	test("status enum", () => {
		const op = createType("public", "status", ["active", "inactive"], dialect);
		expect(op.id).toBe("type.status");
		expect(op.execute[0]?.sql).toBe(`CREATE TYPE "public"."status" AS ENUM ('active', 'inactive')`);
	});
});

describe("addEnumValue", () => {
	test("pending", () => {
		const op = addEnumValue("public", "status", "pending", dialect);
		expect(op.id).toBe("enum.status.pending");
		expect(op.execute[0]?.sql).toBe(`ALTER TYPE "public"."status" ADD VALUE 'pending'`);
	});
});

describe("createView", () => {
	test("active_users", () => {
		const op = createView("public", "active_users", "SELECT id FROM public.user", dialect);
		expect(op.id).toBe("view.active_users");
		expect(op.execute[0]?.sql).toBe(
			'CREATE VIEW "public"."active_users" AS SELECT id FROM public.user',
		);
	});
});

describe("createMaterializedView", () => {
	test("user_counts", () => {
		const op = createMaterializedView(
			"public",
			"user_counts",
			"SELECT count(*) FROM public.user",
			dialect,
		);
		expect(op.id).toBe("matview.user_counts");
		expect(op.execute[0]?.sql).toBe(
			'CREATE MATERIALIZED VIEW "public"."user_counts" AS SELECT count(*) FROM public.user',
		);
	});
});

describe("addUnique", () => {
	test("user_email_key", () => {
		const op = addUnique("public", "user", "user_email_key", ["email"], dialect);
		expect(op.id).toBe("unique.user.user_email_key");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."user" ADD CONSTRAINT "user_email_key" UNIQUE ("email")',
		);
		expect(op.precheck[0]?.sql).toContain("pg_constraint");
		expect(op.precheck[0]?.sql).toContain("NOT EXISTS");
		expect(op.postcheck[0]?.sql).toContain("EXISTS");
		expect(op.postcheck[0]?.sql).not.toContain("NOT EXISTS");
	});
});

describe("createIndex", () => {
	test("post_authorId_idx", () => {
		const op = createIndex("public", "post", "post_authorId_idx", ["authorId"], dialect);
		expect(op.id).toBe("index.post.post_authorId_idx");
		expect(op.execute[0]?.sql).toBe(
			'CREATE INDEX "post_authorId_idx" ON "public"."post" ("authorId")',
		);
		expect(op.outsideTransaction).toBeUndefined();
		expect(op.precheck[0]?.sql).toBe(`SELECT to_regclass('"public"."post_authorId_idx"') IS NULL`);
	});

	test("concurrently", () => {
		const op = createIndex("public", "post", "post_authorId_idx", ["authorId"], dialect, {
			concurrently: true,
		});
		expect(op.execute[0]?.sql).toBe(
			'CREATE INDEX CONCURRENTLY "post_authorId_idx" ON "public"."post" ("authorId")',
		);
		expect(op.outsideTransaction).toBe(true);
		expect(op.label).toContain("concurrently");
	});
});

describe("addForeignKey", () => {
	test("post_authorId_fkey", () => {
		const op = addForeignKey(
			"public",
			"post",
			{
				name: "post_authorId_fkey",
				columns: ["authorId"],
				references: { table: "user", columns: ["id"] },
			},
			dialect,
		);
		expect(op.id).toBe("fk.post.post_authorId_fkey");
		expect(op.execute[0]?.sql).toBe(
			'ALTER TABLE "public"."post"\n  ADD CONSTRAINT "post_authorId_fkey"\n  FOREIGN KEY ("authorId")\n  REFERENCES "public"."user" ("id")',
		);
	});
});

describe("rawSql", () => {
	test("defaults descriptions to sql", () => {
		const op = rawSql({
			label: "Enable pgcrypto",
			precheck: [
				{
					sql: "SELECT NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')",
				},
			],
			execute: [{ sql: "CREATE EXTENSION IF NOT EXISTS pgcrypto" }],
			postcheck: [
				{
					sql: "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')",
				},
			],
		});
		expect(op.precheck[0]?.description).toBe(op.precheck[0]?.sql);
		expect(op.execute[0]?.description).toBe(op.execute[0]?.sql);
		expect(op.id).toBe("enable.pgcrypto");
	});

	test("requires execute and postcheck", () => {
		expect(() =>
			rawSql({ label: "x", execute: [], postcheck: [{ sql: "SELECT true" }] }),
		).toThrow();
	});
});

describe("full migration operations shape", () => {
	test("representative additive ops", () => {
		const ops = [
			createTable("public", "user", [{ name: "id", typeSql: "SERIAL" }], dialect),
			addColumn("public", "user", { name: "email", typeSql: "text", nullable: true }, dialect),
			addPrimaryKey("public", "user", "user_pkey", ["id"], dialect),
			addCheck("public", "user", "user_email_nonempty", "length(email) > 0", dialect),
		];
		expect(ops).toHaveLength(4);
		for (const op of ops) {
			expect(op.postcheck.length).toBeGreaterThan(0);
			expect(op.execute.length).toBeGreaterThan(0);
		}
	});
});
