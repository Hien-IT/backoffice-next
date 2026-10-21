// Spec 020 US1 (FR-010 to FR-015, T033): the parity-hook-audit fixture at both apps. Each app runs the same writes with
// its own `x-bo-ext-trace` tag; the hook logs the events it saw in bo_ext_log, and both logs must match (event names,
// collections, keys as markers). The items.create filter adds `audited`; the init hooks set response headers. The
// schedule hook runs on the extensions pair only (BO_EXT_SCHEDULE=1): once per minute across both apps.
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { type AppName, appUrl } from '../directus-api.js';
import { capture } from '../parity.js';
import { admin, extLog, lastLogId, same } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';
const run = randomUUID().slice(0, 8);

afterAll(async () => {
	await closeHostDb();
});

/** The writes of one app with its trace tag; returns the bo_ext_log rows of that tag, keys replaced by markers. */
async function scenario(app: AppName) {
	const tag = `${app}-${run}`;
	const headers = { ...(await admin()), 'x-bo-ext-trace': tag, 'content-type': 'application/json' };
	const call = (method: string, path: string, body?: Record<string, unknown>) =>
		capture(appUrl(app), { method, path, headers, ...(body === undefined ? {} : { body }) });

	const created = await call('POST', '/items/bo_ext_items', { title: `hooks-${tag}` });
	const id = (created.json as { data: { id: number; audited: boolean } }).data.id;
	await call('PATCH', `/items/bo_ext_items/${id}`, { title: `hooks-${tag}-2` });
	await call('DELETE', `/items/bo_ext_items/${id}`);
	await call('POST', '/fields/bo_ext_items', { field: `tmp_${run}`, type: 'string' });
	await call('DELETE', `/fields/bo_ext_items/tmp_${run}`);
	await call('POST', '/auth/login', { email: 'admin@example.com', password: 'password' });

	await sleep(500);

	const rows = (await extLog()).filter((row) => (row.payload as { tag?: string })?.tag === tag);
	const markers = new Map<unknown, string>();
	const mark = (key: unknown) => {
		if (!markers.has(String(key))) markers.set(String(key), `<key${markers.size}>`);
		return markers.get(String(key));
	};

	return {
		audited: (created.json as { data: { audited: boolean } }).data.audited,
		events: rows.map((row) => {
			const payload = row.payload as { collection: string | null; keys: unknown[] | null };
			return { event: row.event, collection: payload.collection, keys: payload.keys?.map(mark) ?? null };
		}),
	};
}

describe('hooks of the fixture extension', () => {
	it('filter and actions: the same events, in the same order, at both apps', async () => {
		const directus = await scenario('directus');
		const backoffice = await scenario('backoffice');

		expect(directus.audited).toBe(true);
		expect(backoffice).toEqual(directus);
		expect(directus.events.map((e) => e.event)).toEqual(
			expect.arrayContaining(['items.create', 'items.update', 'items.delete', 'fields.create', 'fields.delete']),
		);
	});

	it('init hooks: middlewares.before sets x-bo-ext on every route, routes.custom.before on custom routes', async () => {
		for (const app of ['directus', 'backoffice'] as const) {
			const ping = await capture(appUrl(app), { path: '/server/ping' });
			expect(ping.headers['x-bo-ext'], app).toBe('1');

			const custom = await capture(appUrl(app), { path: '/parity-endpoint-demo' });
			expect(custom.headers['x-bo-ext-custom'], app).toBe('1');
		}

		await same({ path: '/parity-endpoint-demo' });
	});

	it.runIf(full)(
		'schedule: the extensions pair logs one tick per minute across both apps (shared lock <name>:<index>)',
		async () => {
			const start = await lastLogId();
			await sleep(185_000);

			const ticks = (
				await hostDb()('bo_ext_log').where('id', '>', start).andWhere({ kind: 'tick' }).count({ n: '*' })
			)[0]!;
			const n = Number(ticks['n']);
			expect(n).toBeGreaterThanOrEqual(3);
			expect(n).toBeLessThanOrEqual(4);
		},
		240_000,
	);
});
