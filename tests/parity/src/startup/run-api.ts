import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Vendor } from '../get-dbs-to-test.js';

/** Built API entry point (pnpm nx run api:build). */
export const API_MAIN = fileURLToPath(new URL('../../../../apps/api/dist/main.js', import.meta.url));

/** DB settings to reach the parity database from the host (same values as env/<vendor>.env, host ports). */
export function hostDbEnv(vendor: Vendor): Record<string, string> {
	switch (vendor) {
		case 'postgres':
			return {
				DB_CLIENT: 'pg',
				DB_HOST: '127.0.0.1',
				DB_PORT: '6100',
				DB_DATABASE: 'directus',
				DB_USER: 'postgres',
				DB_PASSWORD: 'secret',
			};
		case 'sqlite3':
			return {
				DB_CLIENT: 'sqlite3',
				DB_FILENAME: fileURLToPath(new URL('../../.data/sqlite/data.db', import.meta.url)),
			};
		default:
			throw new Error(`Host DB settings for ${vendor} come with T083`);
	}
}

export interface RunningApi {
	child: ChildProcess;
	output: () => string;
	exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

/** Starts `node dist/main.js` with exactly `env` (plus PATH) in `cwd` (a fresh temp dir by default). */
export function runApi(env: Record<string, string>, cwd = mkdtempSync(join(tmpdir(), 'api-run-'))): RunningApi {
	const child = spawn(process.execPath, [API_MAIN], {
		cwd,
		env: { PATH: process.env['PATH'] ?? '', LOG_STYLE: 'raw', NODE_ENV: 'production', ...env },
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	let output = '';
	child.stdout!.on('data', (chunk) => (output += chunk));
	child.stderr!.on('data', (chunk) => (output += chunk));

	const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
		child.on('exit', (code, signal) => resolve({ code, signal })),
	);

	return { child, output: () => output, exited };
}

/** Waits until GET /server/ping answers pong on `port`, or the process exits. */
export async function waitForPing(api: RunningApi, port: number, timeoutMs = 20_000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (api.child.exitCode !== null || api.child.signalCode !== null) return false;

		try {
			const res = await fetch(`http://127.0.0.1:${port}/server/ping`);
			if ((await res.text()) === 'pong') return true;
		} catch {
			// not listening yet
		}

		await sleep(200);
	}

	return false;
}

export async function stopApi(api: RunningApi): Promise<void> {
	if (api.child.exitCode === null && api.child.signalCode === null) api.child.kill('SIGTERM');
	await api.exited;
}
