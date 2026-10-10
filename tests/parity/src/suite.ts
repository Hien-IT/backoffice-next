// PARITY_SUITE (FR-102, T082): `full` runs every parity file; `reduced` (MySQL and SQLite on every PR) runs the
// server files below, where the cases that stop containers or need a profile pair only run in `full`.
export const REDUCED_FILES = [
	...['ping', 'health', 'info', 'errors', 'methods', 'conditional'].map((f) => `src/server/${f}.test.ts`),
	// Feature 002 (FR-040): the SchemaOverview comparison runs on every vendor of every push.
	'src/schema/overview.test.ts',
	// Feature 003: dates, JSON and booleans written by the auth flows differ per vendor (research R11).
	...['login', 'login-db', 'refresh', 'logout', 'password'].map((f) => `src/auth/${f}.test.ts`),
];

export const FULL_FILES = [
	'src/{server,startup,observability,schema,auth}/**/*.test.ts',
	'src/{db-unchanged,readonly-account,redis-down}.test.ts',
];

export type Suite = 'full' | 'reduced';

export function parseSuite(value = process.env['PARITY_SUITE']): Suite {
	if (value === undefined || value === '' || value === 'full') return 'full';
	if (value === 'reduced') return 'reduced';
	throw new Error(`PARITY_SUITE must be "full" or "reduced", got "${value}"`);
}

export function suiteFiles(suite: Suite): string[] {
	return suite === 'reduced' ? REDUCED_FILES : FULL_FILES;
}
