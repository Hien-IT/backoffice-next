// Feature 010, US2 (spec FR-020, FR-021, contracts/system-api.md §2, §6): /presets at both apps. Reads go to both apps
// at once (the three queries of the hydrate of stores/presets.ts); writes run as scenarios with the presets rows each
// app writes: CRUD as admin, the app minimal permissions (own presets only), bookmarks, and the purge exception of
// CACHE_AUTO_PURGE_IGNORE_LIST (writing a preset does not clear the data cache).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, systemEffects } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const COLLECTION = `parity_presets_${run}`;

let appUser: TestUser; // app access: own presets, the presets of its role and the global ones
let other: TestUser; // another app access user with a preset of its own
let roleId: string;
let otherPreset: number;

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

beforeAll(async () => {
	await appRequest('directus', 'POST', '/collections', {
		collection: COLLECTION,
		schema: {},
		meta: { hidden: true },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
		],
	});

	const appPolicy = await createPolicy('directus', 'presets-app', { app: true });
	roleId = (await appRequest('directus', 'POST', '/roles', { name: `presets-role-${run}`, icon: 'person' })).data.id;
	await attachPolicy('directus', appPolicy, { role: roleId });

	appUser = await createUser('directus', 'presets-app', { role: roleId } as any);
	other = await createUser('directus', 'presets-other', { role: roleId } as any);

	await appRequest('directus', 'POST', '/presets', [
		{ collection: COLLECTION, role: roleId, layout: 'tabular', layout_query: { tabular: { sort: ['id'] } } },
		{ collection: COLLECTION, layout: 'cards' },
		{ collection: COLLECTION, bookmark: 'global bookmark', search: 'x' },
	]);
	otherPreset = (
		await appRequest('directus', 'POST', '/presets', { collection: COLLECTION, user: other.id, layout: 'tabular' })
	).data.id;
}, 300_000);

afterAll(async () => {
	await hostDb()('directus_presets').where({ collection: COLLECTION }).delete();
	await appRequest('directus', 'DELETE', `/collections/${COLLECTION}`);
	await appRequest('directus', 'DELETE', `/roles/${roleId}`).catch(() => undefined);
	await cleanup();
	await closeHostDb();
}, 120_000);

const filter = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe('reads at both apps', () => {
	it('the three queries of the hydrate of stores/presets.ts, as the app access user', async () => {
		const headers = bearer(appUser);

		await same({ path: `/presets?filter[user][_eq]=${appUser.id}&limit=-1`, headers });
		await same({ path: `/presets?filter[role][_eq]=${roleId}&filter[user][_null]=true&limit=-1&sort=id`, headers });
		await same({ path: `/presets?filter[role][_null]=true&filter[user][_null]=true&limit=-1&sort=id`, headers });
	});

	it('admin: list, one, fields, meta, SEARCH; the app user cannot read the preset of another user', async () => {
		const headers = await admin();

		await same({ path: `/presets?filter=${filter({ collection: { _eq: COLLECTION } })}&sort=id&meta=*`, headers });
		await same({ path: `/presets/${otherPreset}?fields=id,user.email,layout`, headers });
		await same({
			method: 'SEARCH',
			path: '/presets',
			headers,
			body: { query: { filter: { collection: { _eq: COLLECTION } }, sort: ['id'] } },
		});
		await same({ path: `/presets/${otherPreset}`, headers: bearer(appUser) });
		await same({ path: `/presets?filter[user][_eq]=${other.id}`, headers: bearer(appUser) });
	});

	it('public, OPTIONS, HEAD', async () => {
		await same({ path: '/presets' });
		await same({ method: 'OPTIONS', path: '/presets' });
		await same({ method: 'OPTIONS', path: '/presets/1' });
		await same({ method: 'HEAD', path: `/presets/${otherPreset}`, headers: await admin() });
	});
});

describe('writes as scenarios', () => {
	it('the app access user: own preset and bookmark created, renamed, deleted; foreign presets refused', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = bearer(appUser);
			const steps: unknown[] = [];

			const { result: created, rows } = await systemEffects(['presets'], () =>
				call(ctx, {
					method: 'POST',
					path: '/presets',
					headers,
					body: {
						collection: COLLECTION,
						user: appUser.id,
						layout: 'tabular',
						layout_options: { tabular: { widths: { id: 90 } } },
					},
				}),
			);
			const id = (created.json as any)?.data?.id;
			steps.push({
				created: snap(created, '/presets', { preset: String(id) }),
				rows: comparable(rows, { preset: id, user: appUser.id }),
			});

			const bookmark = await call(ctx, {
				method: 'POST',
				path: '/presets',
				headers,
				body: { collection: COLLECTION, user: appUser.id, bookmark: 'mine', filter: { id: { _gt: 1 } } },
			});
			const bookmarkId = (bookmark.json as any)?.data?.id;
			const ids = { preset: String(id), bookmark: String(bookmarkId) };

			steps.push(snap(bookmark, '/presets', ids));
			steps.push(
				snap(
					await call(ctx, { method: 'PATCH', path: `/presets/${bookmarkId}`, headers, body: { bookmark: 'renamed' } }),
					'/presets',
					ids,
				),
			);
			steps.push(
				snap(
					await call(ctx, { method: 'PATCH', path: `/presets/${otherPreset}`, headers, body: { layout: 'cards' } }),
					'/presets',
					ids,
				),
			);
			steps.push(
				snap(
					await call(ctx, {
						method: 'POST',
						path: '/presets',
						headers,
						body: { collection: COLLECTION, user: other.id },
					}),
					'/presets',
					ids,
				),
			);
			steps.push(
				snap(await call(ctx, { method: 'DELETE', path: `/presets/${otherPreset}`, headers }), '/presets', ids),
			);
			steps.push(
				snap(await call(ctx, { method: 'DELETE', path: '/presets', headers, body: [id, bookmarkId] }), '/presets', ids),
			);
			steps.push({
				left: await hostDb()('directus_presets').whereIn('id', [id, bookmarkId]).count({ n: '*' }).first(),
			});

			return steps;
		});

		assertSameTranscripts(transcripts, 'presets as the app access user');
	});

	it('admin: array create, batch update by keys and by query, delete by query', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const many = await call(ctx, {
				method: 'POST',
				path: '/presets?fields=id,layout,bookmark',
				headers,
				body: [
					{ collection: COLLECTION, layout: 'tabular', bookmark: 'a' },
					{ collection: COLLECTION, layout: 'cards', bookmark: 'b' },
				],
			});
			const keys = ((many.json as any)?.data ?? []).map((row: any) => row.id);
			const ids = Object.fromEntries(keys.map((k: number, i: number) => [`p${i}`, String(k)]));

			const steps = [snap(many, '/presets', ids)];
			steps.push(
				snap(
					await call(ctx, {
						method: 'PATCH',
						path: '/presets?fields=id,icon',
						headers,
						body: { keys, data: { icon: 'star' } },
					}),
					'/presets',
					ids,
				),
			);
			steps.push(
				snap(
					await call(ctx, {
						method: 'PATCH',
						path: '/presets?fields=id,color',
						headers,
						body: { query: { filter: { id: { _in: keys } } }, data: { color: '#ff0000' } },
					}),
					'/presets',
					ids,
				),
			);
			steps.push(
				snap(
					await call(ctx, {
						method: 'DELETE',
						path: '/presets',
						headers,
						body: { query: { filter: { id: { _in: keys } } } },
					}),
					'/presets',
					ids,
				),
			);
			steps.push(snap(await call(ctx, { method: 'DELETE', path: '/presets', headers, body: {} }), '/presets', ids));
			return steps;
		});

		assertSameTranscripts(transcripts, 'presets as admin');
	});
});

describe('CACHE_AUTO_PURGE_IGNORE_LIST (directus_presets by default)', () => {
	it('writing a preset leaves the cached read of an item in place at both apps', async () => {
		const headers = await admin();
		const item = (await appRequest('directus', 'POST', `/items/${COLLECTION}`, {})).data.id;
		const path = `/items/${COLLECTION}/${item}`;

		for (const app of ['directus', 'backoffice'] as const) {
			const read = () =>
				fetch(new URL(path, urls()[app]), { headers }).then((res) => res.headers.get('x-cache-status'));

			await read();
			expect(await read(), `${app} warm`).toBe('HIT');
			await appRequest(app, 'POST', '/presets', { collection: COLLECTION, layout: 'cards' });
			expect(await read(), `${app} after a preset write`).toBe('HIT');
		}
	});
});
