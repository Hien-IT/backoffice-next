// Feature 010, US7 (spec FR-060, FR-061, contracts/system-api.md §2): /dashboards and /panels at both apps. Reads go
// to both apps at once (the fetchAll queries of stores/insights.ts); writes run as scenarios with the dashboards and
// panels rows each app writes: nested panels on create and update, cascade on delete, and the user without a policy
// (no app minimal permission on these collections).
import { afterAll, beforeAll, describe, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, systemEffects } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const NAME = `parity-dash-${run}`;

let appUser: TestUser; // app access only: no permission on dashboards and panels
let dashboard: string;

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

const panel = (name: string, x: number) => ({
	name,
	type: 'label',
	position_x: x,
	position_y: 1,
	width: 6,
	height: 4,
	show_header: true,
	options: { text: name },
});

beforeAll(async () => {
	const appPolicy = await createPolicy('directus', 'dash-app', { app: true });
	appUser = await createUser('directus', 'dash-app');
	await attachPolicy('directus', appPolicy, { user: appUser.id });

	dashboard = (
		await appRequest('directus', 'POST', '/dashboards', {
			name: `${NAME}-seed`,
			icon: 'insights',
			panels: [panel('seed', 1)],
		})
	).data.id;
}, 300_000);

afterAll(async () => {
	await hostDb()('directus_dashboards').where('name', 'like', `${NAME}%`).delete();
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('reads at both apps', () => {
	it('the fetchAll queries of stores/insights.ts, one dashboard with its panels, SEARCH, OPTIONS', async () => {
		const headers = await admin();

		await same({ path: `/dashboards?fields=*&sort=name&filter[name][_starts_with]=${NAME}&limit=-1`, headers });
		await same({ path: `/panels?fields=*&sort=dashboard&filter[dashboard][_eq]=${dashboard}&limit=-1`, headers });
		await same({ path: `/dashboards/${dashboard}?fields=*,panels.*`, headers });
		await same({ path: `/dashboards?filter[id][_eq]=${dashboard}&meta=*`, headers });
		await same({ method: 'SEARCH', path: '/dashboards', headers, body: { keys: [dashboard] } });
		await same({ method: 'OPTIONS', path: '/dashboards' });
		await same({ method: 'OPTIONS', path: `/panels/${dashboard}` });
	});

	it('a user without a policy on them: 403 at both apps; public too', async () => {
		await same({ path: '/dashboards', headers: bearer(appUser) });
		await same({ path: `/panels?filter[dashboard][_eq]=${dashboard}`, headers: bearer(appUser) });
		await same({ path: '/dashboards' });
	});
});

describe('writes as scenarios', () => {
	it('dashboard with nested panels, nested update, panel CRUD, delete cascades to the panels', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();

			const { result: created, rows } = await systemEffects(['dashboards', 'panels'], () =>
				call(ctx, {
					method: 'POST',
					path: '/dashboards?fields=*,panels.name,panels.position_x',
					headers,
					body: {
						name: `${NAME}-w`,
						icon: 'insights',
						note: 'n',
						color: '#123456',
						panels: [panel('a', 1), panel('b', 7)],
					},
				}),
			);

			const id = (created.json as any)?.data?.id as string;
			const panelIds = (rows.panels ?? []).map((row) => row['id'] as string).sort();
			const ids: Record<string, string> = {
				dashboard: id,
				...Object.fromEntries(panelIds.map((p, i) => [`panel:${i}`, p])),
			};
			const panelRows = async () =>
				comparable(await hostDb()('directus_panels').where({ dashboard: id }).orderBy('name'), ids);

			const steps: Record<string, unknown> = {
				created: snap(created, '/dashboards', ids),
				rows: comparable(rows, ids),
			};

			const firstPanel = (rows.panels ?? []).find((row) => row['name'] === 'a')!['id'] as string;
			const secondPanel = (rows.panels ?? []).find((row) => row['name'] === 'b')!['id'] as string;

			steps['nested'] = snap(
				await call(ctx, {
					method: 'PATCH',
					path: `/dashboards/${id}?fields=panels.name,panels.position_x`,
					headers,
					body: {
						panels: {
							create: [panel('c', 13)],
							update: [{ id: firstPanel, position_x: 3 }],
							delete: [secondPanel],
						},
					},
				}),
				'/dashboards',
				ids,
			);
			steps['afterNested'] = (await panelRows()) as unknown[];

			const extra = await call(ctx, {
				method: 'POST',
				path: '/panels',
				headers,
				body: { ...panel('d', 19), dashboard: id },
			});
			const extraId = (extra.json as any)?.data?.id as string;
			ids['panel:extra'] = extraId;
			steps['extra'] = snap(extra, '/panels', ids);
			steps['patchPanel'] = snap(
				await call(ctx, { method: 'PATCH', path: `/panels/${extraId}`, headers, body: { width: 12 } }),
				'/panels',
				ids,
			);
			steps['refused'] = snap(
				await call(ctx, { method: 'POST', path: '/dashboards', headers: bearer(appUser), body: { name: `${NAME}-x` } }),
				'/dashboards',
				ids,
			);
			steps['deleted'] = snap(
				await call(ctx, { method: 'DELETE', path: `/dashboards/${id}`, headers }),
				'/dashboards',
				ids,
			);
			steps['panelsLeft'] = await hostDb()('directus_panels').where({ dashboard: id }).count({ n: '*' }).first();

			return steps;
		});

		assertSameTranscripts(transcripts, 'dashboards and panels');
	});
});
