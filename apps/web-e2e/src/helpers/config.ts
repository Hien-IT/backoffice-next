// The E2E configuration (specs/012-backoffice-web-shell/contracts/e2e.md §2, FR-071): which web app the browser opens
// and which API it talks to. Admin credentials and SECRET come from the parity env file every app of the parity
// environment reads (tests/parity/env/postgres.env), so they are never copied here.
import { readFileSync } from 'node:fs';

export type E2EConfig = 'proxy-directus' | 'proxy-api' | 'cors' | 'dev';

const CONFIGS: Record<E2EConfig, string> = {
	'proxy-directus': 'http://127.0.0.1:8161',
	'proxy-api': 'http://127.0.0.1:8162',
	cors: 'http://localhost:8181',
	dev: 'http://127.0.0.1:4200',
};

const name = process.env['E2E_CONFIG'] ?? 'dev';
if (!(name in CONFIGS)) throw new Error(`E2E_CONFIG must be one of proxy-directus, proxy-api, cors (got "${name}")`);

export const e2eConfig = name as E2EConfig;
export const isCors = e2eConfig === 'cors';

/** The web app (Playwright baseURL). */
export const webUrl = process.env['BASE_URL'] ?? CONFIGS[e2eConfig];

/** The API the app calls: same origin behind the proxies (and the Vite dev proxy), another site for `cors`. */
export const apiUrl = isCors ? 'http://127.0.0.1:8163' : new URL(webUrl).origin;

/** Directus 11.17.4 of the main parity pair. */
export const directusUrl = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';

/** KEY=VALUE lines of an env file (comments and blank lines ignored). */
export function parseEnv(text: string): Record<string, string> {
	return Object.fromEntries(
		text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#') && line.includes('='))
			.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
	);
}

const parityEnv = parseEnv(readFileSync(new URL('../../../../tests/parity/env/postgres.env', import.meta.url), 'utf8'));

export const ADMIN = { email: parityEnv['ADMIN_EMAIL']!, password: parityEnv['ADMIN_PASSWORD']! };
export const SECRET = parityEnv['SECRET']!;

/** Prefix of every row a spec creates, so the three configurations never touch each other's data (CHK019). */
export const DATA_PREFIX = `web-e2e-${e2eConfig}`;
