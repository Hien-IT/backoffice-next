// PARITY_SUITE (FR-102, T082): `full` runs every parity file; `reduced` (MySQL and SQLite on every PR) runs the
// server files below, where the cases that stop containers or need a profile pair only run in `full`.
export const REDUCED_FILES = [
	...['ping', 'health', 'info', 'errors', 'methods', 'conditional'].map((f) => `src/server/${f}.test.ts`),
	// Feature 002 (FR-040): the SchemaOverview comparison runs on every vendor of every push.
	'src/schema/overview.test.ts',
	// Feature 003: dates, JSON and booleans written by the auth flows differ per vendor (research R11).
	...['login', 'login-db', 'refresh', 'logout', 'password'].map((f) => `src/auth/${f}.test.ts`),
	// Feature 004 (SC-001): the reduced permission matrix, the accountability of US1 and the CRUD flows whose dates and
	// JSON differ per vendor.
	...['matrix-reduced', 'accountability', 'users', 'roles', 'write-rules'].map((f) => `src/permissions/${f}.test.ts`),
	// Feature 005: the /items flows, whose dates, JSON and keys differ per vendor.
	'src/items/crud.test.ts',
	// Feature 006: the HTTP contract of /collections, /fields, /relations (DDL differs per vendor, research R5).
	'src/schema-management/crud.test.ts',
	'src/schema-management/relations.test.ts',
	// Feature 007: the HTTP contract of /files, /folders, /assets (rows and storage objects differ per vendor).
	'src/files/{files,folders,assets}.test.ts',
	// Feature 008 (spec FR-061): one case per route, cross use, ?version= and mentions (history rows differ per vendor);
	// the cases marked full-only inside these files and retention, e2e-app run in `full` only.
	'src/history/{activity,revisions,versions,version-read,comments,cross-use}.test.ts',
	// Feature 009 (spec FR-061): one flow per trigger, each operation on its resolve branch, crud, logs, reload; the
	// cases marked full-only, schedule (its own pair, started by the file) and e2e-app run in `full` only.
	'src/flows/{crud,webhook,manual,event,operations,logs,reload}.test.ts',
	// Feature 010 (spec FR-101): one file per system collection and the small /utils routes; import-export, extensions
	// registry cases, setup (own Postgres, Postgres only) and e2e-app run in `full` only.
	'src/system/{settings,presets,notifications,shares,translations,insights,extensions,utils-misc}.test.ts',
	// Feature 011 (spec FR-060): reads, writes, system operations and the introspection of admin and user A; errors,
	// cache, the nointro pair and e2e-app run in `full` only.
	'src/graphql/{read,write,system,schema}.test.ts',
];

export const FULL_FILES = [
	'src/{server,startup,observability,schema,auth,permissions}/**/*.test.ts',
	'src/{db-unchanged,readonly-account,redis-down}.test.ts',
	// Feature 005: /items and export on the main pair.
	'src/items/{crud,export}.test.ts',
	// Feature 006: data model routes, DDL compared in sequence on the shared DB, cross use (research R5, R6).
	'src/schema-management/**/*.test.ts',
	// Feature 007: files, folders, assets, import, TUS on both storage locations (research R8).
	'src/files/**/*.test.ts',
	// Feature 008: activity, revisions, versions, comments, retention (its own pair, started by the file), e2e-app.
	'src/history/**/*.test.ts',
	// Feature 009: flows and operations, the scheduled flows pair (started by schedule.test.ts), e2e-app.
	'src/flows/**/*.test.ts',
	// Feature 010: settings, presets, notifications, shares, translations, insights, extensions, utils, import-export,
	// setup (its own pair), e2e-app.
	'src/system/**/*.test.ts',
	// Feature 011: GraphQL reads, writes, system operations, introspection and SDL, errors, e2e-app (cache.test.ts runs
	// in the cache suite, it skips without its pair).
	'src/graphql/**/*.test.ts',
];

/** Feature 004 (spec SC-001): the full matrix runs alone, one shard per CI job (PARITY_MATRIX_SHARD). */
export const MATRIX_FILES = ['src/permissions/matrix.test.ts'];

/**
 * Feature 005 (research R5): the response cache configurations and the WebSocket pair (job parity-cache, profiles
 * cache-mem, cache-mem-purge, cache-redis, cache-redis-purge, websocket).
 */
export const CACHE_FILES = [
	'src/items/{cache-blackbox,cache-cross,cache-redis-down,bus}.test.ts',
	// Feature 011 (FR-004, R-31): the GraphQL response cache on the cache-redis-purge pair.
	'src/graphql/cache.test.ts',
];

/**
 * Feature 005 (research R6): the port of directus/tests/blackbox items, query and relational files. Run by
 * scripts/parity.mjs with src/items/blackbox/vitest.blackbox.config.ts, once per app (PARITY_BLACKBOX_APP).
 */
export const BLACKBOX_FILES = ['src/items/blackbox/**/*.test.ts'];

/** Not in `full`: the full matrix has its own target, and Postgres already runs matrix shards. */
export const FULL_EXCLUDED_FILES = ['src/permissions/matrix.test.ts', 'src/permissions/matrix-reduced.test.ts'];

export type Suite = 'full' | 'reduced' | 'matrix' | 'blackbox' | 'cache';

export function parseSuite(value = process.env['PARITY_SUITE']): Suite {
	if (value === undefined || value === '' || value === 'full') return 'full';
	if (value === 'reduced') return 'reduced';
	if (value === 'matrix' || value === 'blackbox' || value === 'cache') return value;
	throw new Error(`PARITY_SUITE must be "full", "reduced", "matrix", "blackbox" or "cache", got "${value}"`);
}

export function suiteFiles(suite: Suite): string[] {
	if (suite === 'reduced') return REDUCED_FILES;
	if (suite === 'matrix') return MATRIX_FILES;
	if (suite === 'blackbox') return BLACKBOX_FILES;
	if (suite === 'cache') return CACHE_FILES;
	return FULL_FILES;
}

export function suiteExcludedFiles(suite: Suite): string[] {
	return suite === 'full' ? FULL_EXCLUDED_FILES : [];
}
