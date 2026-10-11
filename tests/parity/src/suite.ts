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
];

export const FULL_FILES = [
	'src/{server,startup,observability,schema,auth,permissions}/**/*.test.ts',
	'src/{db-unchanged,readonly-account,redis-down}.test.ts',
];

/** Feature 004 (spec SC-001): the full matrix runs alone, one shard per CI job (PARITY_MATRIX_SHARD). */
export const MATRIX_FILES = ['src/permissions/matrix.test.ts'];

/** Not in `full`: the full matrix has its own target, and Postgres already runs matrix shards. */
export const FULL_EXCLUDED_FILES = ['src/permissions/matrix.test.ts', 'src/permissions/matrix-reduced.test.ts'];

export type Suite = 'full' | 'reduced' | 'matrix';

export function parseSuite(value = process.env['PARITY_SUITE']): Suite {
	if (value === undefined || value === '' || value === 'full') return 'full';
	if (value === 'reduced') return 'reduced';
	if (value === 'matrix') return 'matrix';
	throw new Error(`PARITY_SUITE must be "full", "reduced" or "matrix", got "${value}"`);
}

export function suiteFiles(suite: Suite): string[] {
	if (suite === 'reduced') return REDUCED_FILES;
	if (suite === 'matrix') return MATRIX_FILES;
	return FULL_FILES;
}

export function suiteExcludedFiles(suite: Suite): string[] {
	return suite === 'full' ? FULL_EXCLUDED_FILES : [];
}
