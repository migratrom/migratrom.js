export { applyMigrations } from "./runner/applyMigrations.ts";
export { createTable } from "./operations/createTable.ts";
export { addColumn } from "./operations/addColumn.ts";
export { addUnique } from "./operations/addUnique.ts";
export { addCheck } from "./operations/addCheck.ts";
export { addPrimaryKey } from "./operations/addPrimaryKey.ts";
export { addForeignKey } from "./operations/addForeignKey.ts";
export { createIndex } from "./operations/createIndex.ts";
export { createSchema } from "./operations/createSchema.ts";
export { createExtension } from "./operations/createExtension.ts";
export { createSequence } from "./operations/createSequence.ts";
export { setColumnDefault } from "./operations/setColumnDefault.ts";
export { setColumnNotNull } from "./operations/setColumnNotNull.ts";
export { renameColumn } from "./operations/renameColumn.ts";
export { renameTable } from "./operations/renameTable.ts";
export { createType } from "./operations/createType.ts";
export { addEnumValue } from "./operations/addEnumValue.ts";
export { createView } from "./operations/createView.ts";
export { createMaterializedView } from "./operations/createMaterializedView.ts";
export { rawSql } from "./operations/rawSql.ts";
export type { CreateExtensionOptions } from "./operations/createExtension.ts";
export type { AddEnumValueOptions } from "./operations/addEnumValue.ts";
export type {
	Migration,
	Operation,
	Check,
	ExecuteStep,
	ColumnDef,
	PrimaryKey,
	ForeignKeySpec,
	CreateIndexOptions,
	ApplyOptions,
	ApplyResult,
	Db,
	Logger,
} from "./types.ts";
