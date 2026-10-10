// Feature 002, FR-019 (removes D-22): both apps write the same permissions cache keys with values that are equal
// once decoded, so each can read what the other wrote (contracts/redis.md §4).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupFixtures, createRole, createUser, PASSWORD } from '../auth/fixtures.js';
import { closeRedis, decodeMessage, flushSharedCaches, redis } from '../redis.js';
import { createPublicCollection, dropCollections } from './helpers.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const DIRECTUS = process.env['DIRECTUS_URL']!;
const BACKOFFICE = process.env['BACKOFFICE_URL']!;

async function oas(url: string): Promise<{ paths: unknown; components: unknown }> {
	const res = await fetch(new URL('/server/specs/oas', url));
	expect(res.status).toBe(200);
	const { paths, components } = (await res.json()) as { paths: unknown; components: unknown };
	return { paths, components };
}

/** Keys and decoded values under `permissions:` after one request (OAS by default) of `url` on empty shared caches. */
async function permissionsCacheOf(
	url: string,
	request: () => Promise<unknown> = () => oas(url),
): Promise<Record<string, unknown>> {
	await flushSharedCaches();
	await request();
	// withCache does not await the write
	await new Promise((resolve) => setTimeout(resolve, 500));

	const r = redis();
	const entries: Record<string, unknown> = {};

	for await (const keys of r.scanStream({ match: 'permissions:*', count: 500 })) {
		for (const key of keys as string[]) entries[key] = decodeMessage((await r.getBuffer(key))!);
	}

	return entries;
}

describe.runIf(suite === 'full')('shared permissions cache (FR-019)', () => {
	beforeAll(async () => {
		await dropCollections(['parity_perm']);

		// A static filter only: dynamic variables ($CURRENT_USER...) are resolved from feature 004.
		await createPublicCollection(
			'parity_perm',
			[
				{ field: 'title', type: 'string' },
				{ field: 'status', type: 'string' },
			],
			{
				fields: ['id', 'title'],
				permissions: { status: { _eq: 'published' } },
				validation: { title: { _nnull: true } },
				presets: { status: 'draft' },
			},
		);
	}, 60_000);

	afterAll(async () => {
		await dropCollections(['parity_perm']);
		await cleanupFixtures();
		await closeRedis();
	}, 60_000);

	it('same keys and equal values on both sides for the public OAS request', async () => {
		// `policies-ip-access` is written by the cache key of Directus' response cache (utils/get-cache-key.ts), which
		// comes with feature 005 (D-11): not part of this comparison.
		const directus = Object.fromEntries(
			Object.entries(await permissionsCacheOf(DIRECTUS)).filter(
				([key]) => !key.startsWith('permissions:policies-ip-access-'),
			),
		);
		const backoffice = await permissionsCacheOf(BACKOFFICE);

		const names = Object.keys(directus).map((k) => k.replace(/-[0-9a-f]+$/, ''));
		expect(names.sort()).toEqual([
			'permissions:policies',
			'permissions:raw-permissions',
			'permissions:raw-permissions',
		]);
		expect(Object.keys(backoffice).sort()).toEqual(Object.keys(directus).sort());
		expect(backoffice).toStrictEqual(directus);
	});

	it('Backoffice reading what Directus cached answers like when it computes the values itself', async () => {
		await flushSharedCaches();
		const own = await oas(BACKOFFICE);

		await flushSharedCaches();
		await oas(DIRECTUS);
		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(await oas(BACKOFFICE)).toStrictEqual(own);
	});

	// Feature 003 (research R8): the authenticate step caches the roles tree and the global access of the token.
	it('a request with a token: roles-tree and global-access entries like Directus', async () => {
		const user = await createUser('perm-cache', { role: await createRole('parity-perm-cache', { app: true }) });
		const login = await fetch(new URL('/auth/login', DIRECTUS), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: user.email, password: PASSWORD }),
		});
		const { access_token } = ((await login.json()) as { data: { access_token: string } }).data;

		const authenticated = (url: string) => () =>
			fetch(new URL('/users/me/tfa/generate', url), {
				method: 'POST',
				headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
				body: '{}',
			});

		const auth = (entries: Record<string, unknown>) =>
			Object.fromEntries(
				Object.entries(entries).filter(([key]) => /^permissions:(roles-tree|global-access(-roles|-user)?)-/.test(key)),
			);

		const directus = auth(await permissionsCacheOf(DIRECTUS, authenticated(DIRECTUS)));
		const backoffice = auth(await permissionsCacheOf(BACKOFFICE, authenticated(BACKOFFICE)));

		expect(
			Object.keys(directus)
				.map((k) => k.replace(/-[0-9a-f]+$/, ''))
				.sort(),
		).toEqual([
			'permissions:global-access',
			'permissions:global-access-roles',
			'permissions:global-access-user',
			'permissions:roles-tree',
		]);
		expect(backoffice).toStrictEqual(directus);
	});
});
