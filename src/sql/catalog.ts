import { qualified, quoteLiteral, regclassLiteral } from "./identifiers.ts";

function existsSelect(exists: string, negate: boolean): string {
	return negate ? `SELECT NOT ${exists}` : `SELECT ${exists}`;
}

export function columnExistsSql(
	schema: string,
	table: string,
	column: string,
	negate: boolean,
): string {
	const exists = `EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ${quoteLiteral(schema)}
      AND table_name = ${quoteLiteral(table)}
      AND column_name = ${quoteLiteral(column)}
  )`;
	return existsSelect(exists, negate);
}

export function constraintExistsSql(
	schema: string,
	table: string,
	constraintName: string,
	negate: boolean,
): string {
	const reg = regclassLiteral(schema, table);
	const name = quoteLiteral(constraintName);
	const exists = `EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${name} AND conrelid = ${reg}::regclass)`;
	return existsSelect(exists, negate);
}

export function primaryKeyExistsSql(schema: string, table: string, negate: boolean): string {
	const reg = regclassLiteral(schema, table);
	const exists = `EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'p' AND conrelid = ${reg}::regclass)`;
	return existsSelect(exists, negate);
}

export function checkConstraintExistsSql(
	schema: string,
	table: string,
	constraintName: string,
	negate: boolean,
): string {
	const reg = regclassLiteral(schema, table);
	const name = quoteLiteral(constraintName);
	const exists = `EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${name} AND contype = 'c' AND conrelid = ${reg}::regclass)`;
	return existsSelect(exists, negate);
}

export function schemaExistsSql(schema: string, negate: boolean): string {
	const exists = `EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = ${quoteLiteral(schema)}
  )`;
	return existsSelect(exists, negate);
}

export function extensionExistsSql(name: string, negate: boolean): string {
	const exists = `EXISTS (SELECT 1 FROM pg_extension WHERE extname = ${quoteLiteral(name)})`;
	return existsSelect(exists, negate);
}

export function regclassExistsSql(schema: string, name: string, negate: boolean): string {
	const reg = regclassLiteral(schema, name);
	return negate ? `SELECT to_regclass(${reg}) IS NULL` : `SELECT to_regclass(${reg}) IS NOT NULL`;
}

export function enumTypeExistsSql(schema: string, name: string, negate: boolean): string {
	const exists = `EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = ${quoteLiteral(schema)}
      AND t.typname = ${quoteLiteral(name)}
      AND t.typtype = 'e'
  )`;
	return existsSelect(exists, negate);
}

export function enumLabelExistsSql(
	schema: string,
	typeName: string,
	value: string,
	negate: boolean,
): string {
	const exists = `EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = ${quoteLiteral(schema)}
      AND t.typname = ${quoteLiteral(typeName)}
      AND e.enumlabel = ${quoteLiteral(value)}
  )`;
	return existsSelect(exists, negate);
}

export function viewExistsSql(schema: string, name: string, negate: boolean): string {
	const exists = `EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = ${quoteLiteral(schema)}
      AND table_name = ${quoteLiteral(name)}
  )`;
	return existsSelect(exists, negate);
}

export function matviewExistsSql(schema: string, name: string, negate: boolean): string {
	const exists = `EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = ${quoteLiteral(name)} AND schemaname = ${quoteLiteral(schema)})`;
	return existsSelect(exists, negate);
}

export function columnDefaultSetSql(
	schema: string,
	table: string,
	column: string,
	negate: boolean,
): string {
	const exists = `EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ${quoteLiteral(schema)}
      AND table_name = ${quoteLiteral(table)}
      AND column_name = ${quoteLiteral(column)}
      AND column_default IS NOT NULL
  )`;
	return existsSelect(exists, negate);
}

export function columnNotNullSql(
	schema: string,
	table: string,
	column: string,
	negate: boolean,
): string {
	const exists = `EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ${quoteLiteral(schema)}
      AND table_name = ${quoteLiteral(table)}
      AND column_name = ${quoteLiteral(column)}
      AND is_nullable = 'NO'
  )`;
	return existsSelect(exists, negate);
}

/** Qualified relation for ALTER TABLE targets. */
export function alterTable(schema: string, table: string): string {
	return qualified(schema, table);
}
