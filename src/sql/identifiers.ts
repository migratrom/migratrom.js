/** Double-quote an identifier, escaping embedded double-quotes by doubling. */
export function quoteIdent(name: string): string {
	if (name.includes("\0")) throw new Error("identifier contains NUL");
	return `"${name.replaceAll('"', '""')}"`;
}

/** Single-quote a string literal, escaping embedded single-quotes by doubling. */
export function quoteLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

/** Fully-qualified relation name: "schema"."table". */
export function qualified(schema: string, name: string): string {
	return `${quoteIdent(schema)}.${quoteIdent(name)}`;
}

/** A string literal usable inside to_regclass(...): '"schema"."table"'. */
export function regclassLiteral(schema: string, name: string): string {
	return quoteLiteral(qualified(schema, name));
}

/** Comma-joined quoted column list: "a", "b". */
export function quoteIdentList(names: string[]): string {
	return names.map(quoteIdent).join(", ");
}
