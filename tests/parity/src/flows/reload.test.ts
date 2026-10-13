// Feature 009 (T037; spec US5, FR-014, FR-062, SC-005): a change made at one app reaches the flows of the other app
// through the shared bus, in both directions, within 2 seconds, and also the second Backoffice instance (profile
// `multi`) when it runs. Measured: the time from the write to the first trigger that sees the new definition.
import { afterAll, describe, expect, test } from 'vitest';
import { secondBackofficePort } from '../config.js';
import { type AppName, appRequest, appUrl } from '../directus-api.js';
import { cleanupFlows, same, seedFlow, sleep } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';
const seeded: string[] = [];
const SC005_MS = 2000;

afterAll(async () => {
	await cleanupFlows(seeded);
});

/** POST /flows/trigger/:id at an app (public, no token); the parsed body or the status when it has no body. */
async function trigger(url: string, id: string): Promise<unknown> {
	const res = await fetch(new URL(`/flows/trigger/${id}`, url), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{}',
	});

	const text = await res.text();
	return res.status === 200 ? JSON.parse(text) : res.status;
}

/** Milliseconds until `trigger` at `url` gives `expected`, polling every 100 ms (fails after 5 s). */
async function until(url: string, id: string, expected: unknown): Promise<number> {
	const start = Date.now();

	while (Date.now() - start < 5000) {
		if (JSON.stringify(await trigger(url, id)) === JSON.stringify(expected)) return Date.now() - start;
		await sleep(100);
	}

	throw new Error(`${url} never answered ${JSON.stringify(expected)} for ${id}`);
}

const other = (app: AppName): AppName => (app === 'directus' ? 'backoffice' : 'directus');

describe.each(['directus', 'backoffice'] as const)('written at %s', (writer) => {
	test('create, change an operation, deactivate, delete: the other app follows within 2 s each time', async () => {
		const reader = appUrl(other(writer));

		const { id, ids } = await seedFlow(
			{
				trigger: 'webhook',
				options: { method: 'POST' },
				operations: [{ key: 'v', type: 'transform', options: { json: { v: 1 } } }],
			},
			writer,
		);

		seeded.push(id);
		expect(await until(reader, id, { v: 1 })).toBeLessThan(SC005_MS);

		await appRequest(writer, 'PATCH', `/operations/${ids['v']}`, { options: { json: { v: 2 } } });
		expect(await until(reader, id, { v: 2 })).toBeLessThan(SC005_MS);

		await appRequest(writer, 'PATCH', `/flows/${id}`, { status: 'inactive' });
		expect(await until(reader, id, 403)).toBeLessThan(SC005_MS);

		await appRequest(writer, 'DELETE', `/flows/${id}`);
		expect(await until(reader, id, 403)).toBeLessThan(SC005_MS);

		// The writer reloaded too (Redis delivers the message of the bus to the process that published it).
		expect(await trigger(appUrl(writer), id)).toBe(403);
	});
});

test('GET /flows of the Directus store is the same at both apps after the changes', async () => {
	await same({
		path: '/flows?fields[]=*&fields[]=operations.*&limit=-1',
		headers: { authorization: `Bearer ${await import('../directus-api.js').then((m) => m.adminToken('directus'))}` },
	});
});

test.skipIf(!full)('a change at Directus reaches both Backoffice instances (profile multi)', async () => {
	const second = `http://127.0.0.1:${secondBackofficePort}`;
	const alive = await fetch(new URL('/server/ping', second))
		.then((r) => r.ok)
		.catch(() => false);
	if (!alive) return;

	const { id, ids } = await seedFlow(
		{
			trigger: 'webhook',
			options: { method: 'POST' },
			operations: [{ key: 'v', type: 'transform', options: { json: { v: 'a' } } }],
		},
		'directus',
	);

	seeded.push(id);
	await appRequest('directus', 'PATCH', `/operations/${ids['v']}`, { options: { json: { v: 'b' } } });

	expect(await until(appUrl('backoffice'), id, { v: 'b' })).toBeLessThan(SC005_MS);
	expect(await until(second, id, { v: 'b' })).toBeLessThan(SC005_MS);
});
