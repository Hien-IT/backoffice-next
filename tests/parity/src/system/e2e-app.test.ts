// Feature 010, US9 (spec FR-103 API part, contracts/parity.md §2): the requests the Directus app sends for the
// screens of this feature, in its own shapes, compared at both apps (the Playwright file system.spec.ts drives the
// screens themselves): the hydrate of stores/settings.ts, presets.ts, notifications.ts, translations.ts,
// extensions.ts; insights (stores/insights.ts load and save); the Shares sidebar and the shared page
// (shares-sidebar-detail.vue, routes/shared/shared.vue with login({ share }) in session mode); the manual sort of
// use-items.ts and the export of export-sidebar-detail.vue. The imports of the sidebar are in import-export.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, systemEffects } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const ARTICLES = `parity_e2e_sys_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

let appUser: TestUser;
let roleId: string;
let adminId: string;
let adminRole: string;
let dashboard: string;
const items: number[] = [];

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

beforeAll(async () => {
	await appRequest('directus', 'POST', '/collections', {
		collection: ARTICLES,
		schema: {},
		meta: { hidden: true, sort_field: 'sort' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'sort', type: 'integer', meta: {} },
			{ field: 'title', type: 'string', meta: {} },
		],
	});

	for (const [i, title] of ['one', 'two', 'three'].entries())
		items.push((await appRequest('directus', 'POST', `/items/${ARTICLES}`, { title, sort: i + 1 })).data.id);

	const appPolicy = await createPolicy('directus', 'e2e-system-app', { app: true });
	roleId = (await appRequest('directus', 'POST', '/roles', { name: `e2e-system-${run}`, icon: 'person' })).data.id;
	await attachPolicy('directus', appPolicy, { role: roleId });
	appUser = await createUser('directus', 'e2e-system-app', { role: roleId } as any);
	({ id: adminId, role: adminRole } = (await appRequest('directus', 'GET', '/users/me?fields=id,role')).data);

	dashboard = (await appRequest('directus', 'POST', '/dashboards', { name: `parity-e2e-${run}`, icon: 'insights' }))
		.data.id;
}, 300_000);

afterAll(async () => {
	await appRequest('directus', 'DELETE', `/dashboards/${dashboard}`).catch(() => undefined);
	await appRequest('directus', 'DELETE', `/collections/${ARTICLES}`).catch(() => undefined);
	await appRequest('directus', 'DELETE', `/roles/${roleId}`).catch(() => undefined);
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('hydrate of every page (admin and an app access user)', () => {
	it('settings, the three preset queries, the unread count, translations, extensions', async () => {
		for (const [headers, user, role] of [
			[await admin(), adminId, null],
			[bearer(appUser), appUser.id, roleId],
		] as const) {
			await same({ path: '/settings', headers });

			await same({ path: `/presets?filter[user][_eq]=${user}&limit=-1`, headers });
			if (role) await same({ path: `/presets?filter[role][_eq]=${role}&filter[user][_null]=true&limit=-1`, headers });
			await same({ path: '/presets?filter[role][_null]=true&filter[user][_null]=true&limit=-1', headers });

			const unread = { _and: [{ recipient: { _eq: user } }, { status: { _eq: 'inbox' } }] };
			await same({ path: `/notifications?filter=${json(unread)}&aggregate[count]=id`, headers });

			await same({
				path: '/translations?fields[]=language&fields[]=key&fields[]=value&filter[language][_eq]=en-US&limit=-1',
				headers,
			});
			await same({ path: '/extensions', headers });
			await same({ path: '/extensions/sources/index.js', headers });
		}
	});
});

describe('insights', () => {
	it('load (dashboards and panels, all of them) and the save of a dashboard: panels created, updated, deleted in batch', async () => {
		const headers = await admin();

		await same({ path: '/dashboards?fields[]=*&sort[]=name&limit=-1', headers });
		await same({ path: '/panels?fields[]=*&sort[]=dashboard&limit=-1', headers });

		const panel = (name: string, x: number) => ({
			dashboard,
			name,
			type: 'label',
			position_x: x,
			position_y: 1,
			width: 6,
			height: 6,
			show_header: false,
			options: { text: name },
		});

		const transcripts = await scenario(urls(), async (ctx) => {
			const { result: created, rows } = await systemEffects(['panels'], () =>
				call(ctx, { method: 'POST', path: '/panels', headers, body: [panel('a', 1), panel('b', 7)] }),
			);
			const byName = (a: any, b: any) => String(a.name).localeCompare(String(b.name));
			rows.panels?.sort(byName);
			(created.json as any)?.data?.sort(byName);
			const ids = Object.fromEntries((rows.panels ?? []).map((row) => [`panel:${row['name']}`, row['id'] as string]));
			const [a, b] = [ids['panel:a']!, ids['panel:b']!];

			const steps = {
				created: snap(created, '/panels', ids),
				rows: comparable(rows, ids),
				updated: snap(
					await call(ctx, { method: 'PATCH', path: '/panels', headers, body: [{ id: a, position_x: 3 }] }),
					'/panels',
					ids,
				),
				deleted: snap(await call(ctx, { method: 'DELETE', path: '/panels', headers, body: [a, b] }), '/panels', ids),
				left: await hostDb()('directus_panels').whereIn('id', [a, b]).count({ n: '*' }).first(),
			};

			return steps;
		});

		assertSameTranscripts(transcripts, 'insights save');
		expect(transcripts.backoffice.created.status).toBe(200);
		expect(transcripts.backoffice.left).toEqual({ n: expect.anything() });
		expect(Number((transcripts.backoffice.left as any).n)).toBe(0);
	});
});

describe('Shares sidebar and the shared page', () => {
	it('create, count and list of the item, then info and login in session mode, the item read as the share', async () => {
		const headers = await admin();
		const item = items[0]!;
		const ofItem = { _and: [{ collection: { _eq: ARTICLES } }, { item: { _eq: String(item) } }] };

		const transcripts = await scenario(urls(), async (ctx) => {
			const { result: created, rows } = await systemEffects(['shares'], () =>
				call(ctx, {
					method: 'POST',
					path: '/shares',
					headers,
					body: {
						name: 'e2e',
						role: adminRole,
						password: 'pw',
						max_uses: 3,
						collection: ARTICLES,
						item: String(item),
					},
				}),
			);
			const share = rows.shares?.[0]?.['id'] as string;
			const ids = { share };

			const count = await call(ctx, { path: `/shares?filter=${json(ofItem)}&aggregate[count]=id`, headers });
			const list = await call(ctx, { path: `/shares?filter=${json(ofItem)}&sort=name`, headers });
			const info = await call(ctx, { path: `/shares/info/${share}` });
			const login = await call(ctx, {
				method: 'POST',
				path: '/shares/auth',
				body: { share, password: 'pw', mode: 'session' },
			});
			const cookie = ([] as string[])
				.concat((login.headers['set-cookie'] as string | string[] | undefined) ?? [])
				.map((c) => c.split(';')[0])
				.join('; ');

			return {
				created: { status: created.status },
				rows: comparable(rows, ids),
				count: { status: count.status, body: count.json },
				list: { status: list.status, names: ((list.json as any)?.data ?? []).map((s: any) => s.name) },
				info: snap(info, '/shares', ids),
				login: { status: login.status, body: login.json, cookies: cookie.split('; ').map((c) => c.split('=')[0]) },
				itemAsShare: snap(await call(ctx, { path: `/items/${ARTICLES}/${item}`, headers: { cookie } }), '/items', ids),
				otherItem: snap(
					await call(ctx, { path: `/items/${ARTICLES}/${items[1]}`, headers: { cookie } }),
					'/items',
					ids,
				),
				// The run of the other app starts without this share.
				deleted: snap(await call(ctx, { method: 'DELETE', path: `/shares/${share}`, headers }), '/shares', ids),
			};
		});

		assertSameTranscripts(transcripts, 'shares sidebar');
		const { login, itemAsShare, otherItem } = transcripts.backoffice;
		expect([login.status, login.cookies]).toEqual([200, ['directus_session_token']]);
		expect([itemAsShare.status, otherItem.status]).toEqual([200, 403]);
	});
});

describe('manual sort and export of the content module', () => {
	it('POST /utils/sort/:collection as use-items.ts sends it, then the order', async () => {
		const headers = await admin();

		const transcripts = await scenario(urls(), async (ctx) => {
			const steps = {
				sort: snap(
					await call(ctx, {
						method: 'POST',
						path: `/utils/sort/${ARTICLES}`,
						headers,
						body: { item: items[0], to: items[2] },
					}),
					'/utils',
				),
				order: await hostDb()(ARTICLES).select('id').orderBy('sort'),
				// Back to sort values 1, 2, 3 (the first item takes the sort value of the second, now 1).
				back: snap(
					await call(ctx, {
						method: 'POST',
						path: `/utils/sort/${ARTICLES}`,
						headers,
						body: { item: items[0], to: items[1] },
					}),
					'/utils',
				),
				restored: await hostDb()(ARTICLES).select('id', 'sort').orderBy('id'),
			};

			return steps;
		});

		assertSameTranscripts(transcripts, 'manual sort');
		expect(transcripts.backoffice.order.map((row: any) => row.id)).toEqual([items[1], items[2], items[0]]);
	});

	it('POST /utils/export/:collection with the body of export-sidebar-detail.vue', async () => {
		await same({
			method: 'POST',
			path: `/utils/export/${ARTICLES}`,
			headers: await admin(),
			body: { query: { limit: -1, fields: ['*'], sort: ['id'] }, format: 'csv', file: { folder: null } },
		});
	});
});
