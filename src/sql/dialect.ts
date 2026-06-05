import type { Db, DialectCapabilities, SQLDialect } from "../types.ts";
import {
	checkConstraintExistsSql,
	columnDefaultSetSql,
	columnExistsSql,
	columnNotNullSql,
	constraintExistsSql,
	enumLabelExistsSql,
	enumTypeExistsSql,
	extensionExistsSql,
	matviewExistsSql,
	primaryKeyExistsSql,
	regclassExistsSql,
	schemaExistsSql,
	viewExistsSql,
} from "./catalog.ts";
import { renderColumnDef, renderColumnList } from "./columns.ts";
import { qualified, quoteIdent, quoteIdentList, quoteLiteral } from "./identifiers.ts";

const POSTGRES_CAPABILITIES: DialectCapabilities = {
	enumTypes: true,
	sequences: true,
	materializedViews: true,
	extensions: true,
	concurrentIndexes: true,
	schemas: true,
	advisoryLocks: true,
	addCheckConstraints: true,
	addPrimaryKeyConstraints: true,
	addUniqueConstraints: true,
	addForeignKeys: true,
	alterColumnDefault: true,
	alterColumnNotNull: true,
};

const SQLITE_CAPABILITIES: DialectCapabilities = {
	enumTypes: false,
	sequences: false,
	materializedViews: false,
	extensions: false,
	concurrentIndexes: false,
	schemas: false,
	advisoryLocks: false,
	addCheckConstraints: false,
	addPrimaryKeyConstraints: false,
	addUniqueConstraints: false,
	addForeignKeys: false,
	alterColumnDefault: false,
	alterColumnNotNull: false,
};

export class PostgresDialect implements SQLDialect {
	readonly name = "postgres";
	readonly capabilities = POSTGRES_CAPABILITIES;

	quoteIdent = quoteIdent;
	quoteLiteral = quoteLiteral;
	qualified = qualified;
	quoteIdentList = quoteIdentList;
	renderColumnDef = renderColumnDef;
	renderColumnList = renderColumnList;

	createIndexSql(
		schema: string,
		table: string,
		indexName: string,
		columns: string[],
		concurrently: boolean,
	): string {
		const concurrentlySql = concurrently ? " CONCURRENTLY" : "";
		return `CREATE INDEX${concurrentlySql} ${quoteIdent(indexName)} ON ${qualified(schema, table)} (${quoteIdentList(columns)})`;
	}

	tableExistsSql = regclassExistsSql;
	columnExistsSql = columnExistsSql;
	constraintExistsSql = constraintExistsSql;
	primaryKeyExistsSql = primaryKeyExistsSql;
	checkConstraintExistsSql = checkConstraintExistsSql;
	schemaExistsSql = schemaExistsSql;
	extensionExistsSql = extensionExistsSql;
	enumTypeExistsSql = enumTypeExistsSql;
	enumLabelExistsSql = enumLabelExistsSql;
	viewExistsSql = viewExistsSql;
	matviewExistsSql = matviewExistsSql;
	columnDefaultSetSql = columnDefaultSetSql;
	columnNotNullSql = columnNotNullSql;

	createHistoryTableSql(name: string): string {
		const table = quoteIdent(name);
		return `
      CREATE TABLE IF NOT EXISTS ${table} (
        id          bigint PRIMARY KEY,
        parent_id   bigint,
        applied_at  timestamptz NOT NULL DEFAULT now(),
        operations  text NOT NULL,
        checksum    text NOT NULL
      )`.trim();
	}

	async acquireLock(db: Db, key: bigint): Promise<void> {
		await db.execute(`SELECT pg_advisory_lock(${key})`);
	}

	async releaseLock(db: Db, key: bigint): Promise<void> {
		await db.execute(`SELECT pg_advisory_unlock(${key})`);
	}
}

function existsSelect(exists: string, negate: boolean): string {
	return negate ? `SELECT NOT ${exists}` : `SELECT ${exists}`;
}

function unsupportedProbe(negate: boolean): string {
	return negate ? "SELECT 1" : "SELECT 0";
}

export class SQLiteDialect implements SQLDialect {
	readonly name = "sqlite";
	readonly capabilities = SQLITE_CAPABILITIES;

	quoteIdent = quoteIdent;
	quoteLiteral = quoteLiteral;
	qualified = qualified;
	quoteIdentList = quoteIdentList;
	renderColumnDef = renderColumnDef;
	renderColumnList = renderColumnList;

	createIndexSql(
		schema: string,
		table: string,
		indexName: string,
		columns: string[],
		_concurrently: boolean,
	): string {
		return `CREATE INDEX ${qualified(schema, indexName)} ON ${quoteIdent(table)} (${quoteIdentList(columns)})`;
	}

	tableExistsSql(schema: string, table: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM ${quoteIdent(schema)}.sqlite_master
    WHERE name = ${quoteLiteral(table)}
      AND type IN ('table', 'index', 'view')
  )`;
		return existsSelect(exists, negate);
	}

	columnExistsSql(_schema: string, table: string, column: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM pragma_table_info(${quoteLiteral(table)})
    WHERE name = ${quoteLiteral(column)}
  )`;
		return existsSelect(exists, negate);
	}

	constraintExistsSql(_schema: string, _table: string, _name: string, negate: boolean): string {
		return unsupportedProbe(negate);
	}

	primaryKeyExistsSql(_schema: string, table: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM pragma_table_info(${quoteLiteral(table)})
    WHERE pk > 0
  )`;
		return existsSelect(exists, negate);
	}

	checkConstraintExistsSql(
		_schema: string,
		_table: string,
		_name: string,
		negate: boolean,
	): string {
		return unsupportedProbe(negate);
	}

	schemaExistsSql(schema: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM pragma_database_list
    WHERE name = ${quoteLiteral(schema)}
  )`;
		return existsSelect(exists, negate);
	}

	extensionExistsSql(_name: string, negate: boolean): string {
		return unsupportedProbe(negate);
	}

	enumTypeExistsSql(_schema: string, _name: string, negate: boolean): string {
		return unsupportedProbe(negate);
	}

	enumLabelExistsSql(_schema: string, _typeName: string, _value: string, negate: boolean): string {
		return unsupportedProbe(negate);
	}

	viewExistsSql(schema: string, name: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM ${quoteIdent(schema)}.sqlite_master
    WHERE name = ${quoteLiteral(name)}
      AND type = 'view'
  )`;
		return existsSelect(exists, negate);
	}

	matviewExistsSql(_schema: string, _name: string, negate: boolean): string {
		return unsupportedProbe(negate);
	}

	columnDefaultSetSql(_schema: string, table: string, column: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM pragma_table_info(${quoteLiteral(table)})
    WHERE name = ${quoteLiteral(column)}
      AND dflt_value IS NOT NULL
  )`;
		return existsSelect(exists, negate);
	}

	columnNotNullSql(_schema: string, table: string, column: string, negate: boolean): string {
		const exists = `EXISTS (
    SELECT 1 FROM pragma_table_info(${quoteLiteral(table)})
    WHERE name = ${quoteLiteral(column)}
      AND "notnull" = 1
  )`;
		return existsSelect(exists, negate);
	}

	createHistoryTableSql(name: string): string {
		const table = quoteIdent(name);
		return `
      CREATE TABLE IF NOT EXISTS ${table} (
        id          INTEGER PRIMARY KEY,
        parent_id   INTEGER,
        applied_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        operations  TEXT NOT NULL,
        checksum    TEXT NOT NULL
      )`.trim();
	}

	async acquireLock(_db: Db, _key: bigint): Promise<void> {}
	async releaseLock(_db: Db, _key: bigint): Promise<void> {}
}
