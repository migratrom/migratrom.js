export const PG_HOST = "127.0.0.1";
export const PG_PORT = 5432;
export const PG_USER = "postgres";

export const ADMIN_DB = "postgres";
export const TEST_DB = "migratrom_it";

export const ADMIN_URL = `postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/${ADMIN_DB}`;
export const TEST_URL = `postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/${TEST_DB}`;
