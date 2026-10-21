// Spec 020 (T019, contracts/tests.md §3): helpers of the extensions parity files. The main pair and the second
// Backoffice of the `multi` profile load the fixture extensions of tests/fixtures/extensions from the shared S3 location
// (EXTENSIONS_LOCATION=s3); the rows of directus_extensions and bo_ext_log are read from the host with SELECT only.
import { setTimeout as sleep } from 'node:timers/promises';
import { hostDb } from '../auth/db-effects.js';
import { appPorts, secondBackofficePort } from '../config.js';
import { compose } from '../docker.js';

export { admin } from '../files/helpers.js';
export { same } from '../system/helpers.js';

/** The fixture extensions loaded at the main pair (folder names under extensions/ of the shared storage). */
export const FIXTURES = [
	'parity-bundle-tools',
	'parity-display-badge',
	'parity-endpoint-demo',
	'parity-endpoint-express4',
	'parity-endpoint-express4-path',
	'parity-endpoint-sandbox',
	'parity-hook-audit',
	'parity-hook-sandbox',
	'parity-interface-color',
	'parity-layout-grid',
	'parity-module-report',
	'parity-operation-sandbox',
	'parity-operation-slack',
	'parity-panel-counter',
] as const;

/** Base URLs of the nodes sharing the database: Directus, Backoffice, the second Backoffice (profile `multi`). */
export function nodes(): { name: 'directus' | 'backoffice' | 'backoffice-2'; url: string }[] {
	return [
		{ name: 'directus', url: `http://127.0.0.1:${appPorts.directus}` },
		{ name: 'backoffice', url: `http://127.0.0.1:${appPorts.backoffice}` },
		{ name: 'backoffice-2', url: `http://127.0.0.1:${secondBackofficePort}` },
	];
}

/** Calls `fn` every 500 ms until it resolves without throwing, for at most `timeout` ms (SC-003: 10 s). */
export async function waitAll<T>(fn: () => Promise<T>, timeout = 10_000): Promise<T> {
	const deadline = Date.now() + timeout;

	for (;;) {
		try {
			return await fn();
		} catch (error) {
			if (Date.now() >= deadline) throw error;
			await sleep(500);
		}
	}
}

/** Log lines of a compose service written since `since` (a Date or a docker duration such as '30s'). */
export function containerLog(service: string, since: Date | string): string {
	const from = since instanceof Date ? since.toISOString() : since;
	return compose('logs', '--no-color', '--no-log-prefix', '--since', from, service);
}

export interface ExtensionRow {
	id: string;
	enabled: boolean;
	folder: string;
	source: string;
	bundle: string | null;
}

/** The rows of directus_extensions, booleans normalized (MySQL and SQLite store 0/1), ordered by folder. */
export async function extRows(): Promise<ExtensionRow[]> {
	const rows = await hostDb()('directus_extensions').select('*').orderBy(['folder', 'id']);
	return rows.map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
}

export interface LogRow {
	id: number;
	kind: string;
	event: string;
	payload: unknown;
}

/** The rows bo_ext_log written after `afterId` by the parity-hook-audit fixture, payload parsed. */
export async function extLog(afterId = 0): Promise<LogRow[]> {
	const rows = await hostDb()('bo_ext_log').select('*').where('id', '>', afterId).orderBy('id');
	return rows.map((row) => ({
		...row,
		payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
	}));
}

/** The highest id of bo_ext_log, the marker before a request. */
export async function lastLogId(): Promise<number> {
	return Number((await hostDb()('bo_ext_log').max({ m: 'id' }).first())?.['m'] ?? 0);
}

/** Runs `script` with the MinIO client inside the minio container, alias `local` set (the shared S3 storage). */
export function mc(script: string): string {
	return compose(
		'exec',
		'-T',
		'minio',
		'sh',
		'-c',
		`mc alias set local http://127.0.0.1:9000 minioadmin minioadmin >/dev/null && ${script}`,
	);
}
