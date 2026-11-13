// Spec 032 (contracts/tests.md §2b): helpers of the environment sync suite. The source is backoffice-api of the main pair
// (reached from the target containers as http://backoffice-api:8055, with an admin token it issued); the target is
// backoffice-api-sync on its own database (profile sync), node 2 on the same database.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { adminToken, appRequest } from '../directus-api.js';
import { logs } from '../docker.js';

export const TARGET = process.env['BACKOFFICE_URL_SYNC'];
export const TARGET_2 = process.env['BACKOFFICE_URL_SYNC_2'];

/** The source as the target containers reach it. */
export const SOURCE_IN_DOCKER = 'http://backoffice-api:8055';
/** Node 2 of the target, as node 1 reaches it (same database: "source equals target"). */
export const TARGET_2_IN_DOCKER = 'http://backoffice-api-sync-2:8055';
/** The fake sources of tests/parity/registry/server.mjs. */
export const fakeSource = (name: string) => `http://registry:9100/sync-fake/${name}`;

const env = readFileSync(fileURLToPath(new URL('../../env/profile-sync.env', import.meta.url)), 'utf8');

/** Static admin token of the target database (env/profile-sync.env). */
export const TARGET_TOKEN = /^ADMIN_TOKEN=(.*)$/m.exec(env)![1]!.trim();

/** Admin token of the source (the main Backoffice). */
export const sourceToken = () => adminToken('backoffice');

export interface Answer<T = any> {
	status: number;
	body: T;
}

/** A request to a target node as its admin (or with another token), status and body kept. */
export async function target<T = any>(
	method: string,
	path: string,
	body?: unknown,
	{ base = TARGET!, token = TARGET_TOKEN }: { base?: string; token?: string | null } = {},
): Promise<Answer<T>> {
	const res = await fetch(new URL(path, base), {
		method,
		headers: {
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...(body !== undefined ? { 'content-type': 'application/json' } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	});

	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

/** A request to the source as its admin; throws on 4xx/5xx. */
export const source = (method: string, path: string, body?: unknown) => appRequest('backoffice', method, path, body);

export async function diff(groups: string[], over: Record<string, unknown> = {}, base = TARGET!) {
	return target(
		'POST',
		'/backoffice/sync/diff',
		{ url: SOURCE_IN_DOCKER, token: await sourceToken(), groups, ...over },
		{ base },
	);
}

export async function apply(
	compared: { hash: string; groups: string[] },
	selected: string[],
	over: Record<string, unknown> = {},
	base = TARGET!,
) {
	return target(
		'POST',
		'/backoffice/sync/apply',
		{
			url: SOURCE_IN_DOCKER,
			token: await sourceToken(),
			hash: compared.hash,
			groups: compared.groups,
			selected,
			...over,
		},
		{ base },
	);
}

export const rowOf = (rows: { id: string }[], id: string) => rows.find((r) => r.id === id) as any;

/** Logs of both target nodes. */
export const targetLogs = () => logs('backoffice-api-sync') + logs('backoffice-api-sync-2');

/** Ids made per run, so a rerun on a kept environment never meets rows of an earlier run. */
export const uuid = () => crypto.randomUUID();
