// Feature 010, US5 (spec FR-080 to FR-083, FR-086 to FR-088, FR-051, contracts/utils-api.md): the small /utils routes
// at both apps: random string, hash generate and verify (a hash of one app verified at the other), sort with its
// event and cache purge, revert, cache clear, resolve-redirect and translations/generate. R-26 (sort skips the row
// filter of the update permission) and R-27 (public routes) are measured on Directus and reproduced.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { type AppName, appRequest } from '../directus-api.js';
import { cleanupFlows, runRows, seedFlow, settled, until } from '../flows/helpers.js';
import { capture } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, verifyHashAt } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const SORTED = `parity_sort_${run}`;
const full = process.env['PARITY_SUITE'] !== 'reduced';
const flows: string[] = [];

let limited: TestUser; // update on SORTED only where status = draft (R-26), read all
let noSortField: TestUser; // update on SORTED without the sort field

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

beforeAll(async () => {
	await appRequest('directus', 'POST', '/collections', {
		collection: SORTED,
		schema: {},
		meta: { hidden: true, sort_field: 'sort', accountability: 'all' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'sort', type: 'integer', meta: {} },
			{ field: 'status', type: 'string', meta: {} },
			{ field: 'title', type: 'string', meta: {} },
		],
	});

	const read = { collection: SORTED, action: 'read' as const, fields: ['*'], permissions: {} };
	const draftsOnly = await createPolicy('directus', 'sort-drafts', {
		permissions: [
			read,
			{ collection: SORTED, action: 'update' as const, fields: ['*'], permissions: { status: { _eq: 'draft' } } },
		],
	});
	const titleOnly = await createPolicy('directus', 'sort-title', {
		permissions: [read, { collection: SORTED, action: 'update' as const, fields: ['title'], permissions: {} }],
	});

	limited = await createUser('directus', 'sort-limited');
	noSortField = await createUser('directus', 'sort-title');
	await attachPolicy('directus', draftsOnly, { user: limited.id });
	await attachPolicy('directus', titleOnly, { user: noSortField.id });
}, 300_000);

afterAll(async () => {
	await cleanupFlows(flows);
	await appRequest('directus', 'DELETE', `/collections/${SORTED}`);
	await cleanup();
	await closeHostDb();
}, 120_000);

/**
 * Four rows with sort 1..4 (status published, draft, draft, published), written through Directus (the host may not
 * write the SQLite file on Linux CI); their ids in creation order.
 */
async function seedRows(sorts: (number | null)[] = [1, 2, 3, 4]): Promise<number[]> {
	await appRequest('directus', 'DELETE', `/items/${SORTED}`, { query: { limit: -1 } });
	const statuses = ['published', 'draft', 'draft', 'published'];
	const created = await appRequest(
		'directus',
		'POST',
		`/items/${SORTED}?fields=id`,
		sorts.map((sort, i) => ({ sort, status: statuses[i % 4], title: `t${i}` })),
	);
	return created.data.map((row: { id: number }) => row.id);
}

const sortState = async (ids: number[]) =>
	(await hostDb()(SORTED).select('id', 'sort').orderBy('id')).map((row) => [ids.indexOf(row.id), row.sort]);

describe('random string, hash', () => {
	it('GET /utils/random/string: length and alphabet; bad lengths answer the same 400', async () => {
		for (const app of ['directus', 'backoffice'] as AppName[]) {
			for (const length of [1, 32, 500]) {
				const res = await capture(urls()[app], { path: `/utils/random/string?length=${length}` });
				expect((res.json as any).data, `${app} ${length}`).toMatch(new RegExp(`^[\\w-]{${length}}$`));
			}
		}

		await same({ path: '/utils/random/string?length=0' });
		await same({ path: '/utils/random/string?length=501' });
		await same({ path: '/utils/random/string?length=abc' });
		await same({ path: '/utils/random/string?length=1&length=2' });
		await same({ method: 'OPTIONS', path: '/utils/random/string' });
	});

	it('a hash of one app verifies at the other; required fields and a broken hash answer the same', async () => {
		for (const [maker, checker] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const hash = (await appRequest(maker, 'POST', '/utils/hash/generate', { string: 'parity secret' })).data;
			expect(hash).toMatch(/^\$argon2id\$/);
			expect(await verifyHashAt(checker, hash, 'parity secret')).toBe(true);
			expect(await verifyHashAt(checker, hash, 'other')).toBe(false);
		}

		await same({ method: 'POST', path: '/utils/hash/generate', body: {} });
		await same({ method: 'POST', path: '/utils/hash/verify', body: { string: 'x' } });
		await same({ method: 'POST', path: '/utils/hash/verify', body: { hash: 'x' } });
		await same({ method: 'POST', path: '/utils/hash/verify', body: { string: 'x', hash: 'broken' } });
	});
});

describe('POST /utils/sort/:collection', () => {
	it('moves, fills nulls, renumbers duplicates; same sort values at both apps', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const steps: unknown[] = [];

			let ids = await seedRows();
			steps.push(
				snap(
					await call(ctx, {
						method: 'POST',
						path: `/utils/sort/${SORTED}`,
						headers,
						body: { item: ids[0], to: ids[2] },
					}),
					'/utils',
				),
			);
			steps.push(await sortState(ids));
			steps.push(
				snap(
					await call(ctx, {
						method: 'POST',
						path: `/utils/sort/${SORTED}`,
						headers,
						body: { item: ids[3], to: ids[0] },
					}),
					'/utils',
				),
			);
			steps.push(await sortState(ids));

			ids = await seedRows([1, 1, null, 2]);
			steps.push(
				snap(
					await call(ctx, {
						method: 'POST',
						path: `/utils/sort/${SORTED}`,
						headers,
						body: { item: ids[2], to: ids[0] },
					}),
					'/utils',
				),
			);
			steps.push(await sortState(ids));

			return steps;
		});

		assertSameTranscripts(transcripts, 'sort');
	});

	it('errors: unknown collection, bad body, no sort field, missing item, no update right on the sort field', async () => {
		const headers = await admin();
		const ids = await seedRows();

		await same({ method: 'POST', path: '/utils/sort/nope_collection', headers, body: { item: 1, to: 2 } });
		await same({ method: 'POST', path: `/utils/sort/${SORTED}`, headers, body: { item: ids[0] } });
		await same({ method: 'POST', path: '/utils/sort/directus_users', headers, body: { item: 1, to: 2 } });
		await same({
			method: 'POST',
			path: `/utils/sort/${SORTED}`,
			headers: bearer(noSortField),
			body: { item: ids[0], to: ids[1] },
		});
		await same({ method: 'POST', path: `/utils/sort/${SORTED}`, body: { item: ids[0], to: ids[1] } });

		// Not in the table: Directus reads `undefined[sortField]` (Edge Cases of the spec).
		const missing = await same({
			method: 'POST',
			path: `/utils/sort/${SORTED}`,
			headers,
			body: { item: ids[0], to: 999999 },
		});
		process.stdout.write(`sort with a missing item measured: ${missing.directus.status}\n`);
	});

	it('R-26: an update permission limited to drafts still moves a published row (measured on Directus)', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const ids = await seedRows();
			const activity = Number((await hostDb().max({ m: 'id' }).from('directus_activity').first())?.['m'] ?? 0);
			const res = await call(ctx, {
				method: 'POST',
				path: `/utils/sort/${SORTED}`,
				headers: bearer(limited),
				body: { item: ids[0], to: ids[3] },
			});
			const history = await hostDb()('directus_activity')
				.where('id', '>', activity)
				.andWhere({ collection: SORTED })
				.count({ n: '*' })
				.first();
			return { res: snap(res, '/utils'), state: await sortState(ids), history };
		});

		assertSameTranscripts(transcripts, 'R-26');
		process.stdout.write(`R-26 measured: ${JSON.stringify(transcripts.directus)}\n`);
	});

	it.runIf(full)('the items.sort action of a flow runs once, at the app that got the request', async () => {
		const { id } = await seedFlow({
			trigger: 'event',
			options: { type: 'action', scope: ['items.sort'], collections: [SORTED] },
			operations: [{ key: 'log', type: 'log', options: { message: 'sorted {{ $trigger.payload.item }}' } }],
		});
		flows.push(id, await settled());

		for (const app of ['directus', 'backoffice'] as AppName[]) {
			const ids = await seedRows();
			const last = Number((await hostDb().max({ m: 'id' }).from('directus_activity').first())?.['m'] ?? 0);
			await appRequest(app, 'POST', `/utils/sort/${SORTED}`, { item: ids[0], to: ids[1] });
			expect(await until(async () => (await runRows(id, last)).length === 1), app).toBe(true);
		}
	});
});

describe('POST /utils/revert/:revision', () => {
	it.runIf(full)('an item back to a revision; a revision that does not exist; a revision without data', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const ids = await seedRows([1]);
			await appRequest('directus', 'PATCH', `/items/${SORTED}/${ids[0]}`, { title: 'first' });
			await appRequest('directus', 'PATCH', `/items/${SORTED}/${ids[0]}`, { title: 'second' });
			const revisions = await hostDb()('directus_revisions')
				.where({ collection: SORTED, item: String(ids[0]) })
				.orderBy('id');
			const first = revisions.at(-2)!;

			const reverted = await call(ctx, { method: 'POST', path: `/utils/revert/${first.id}`, headers });
			const item = await hostDb()(SORTED).select('title').where({ id: ids[0] }).first();
			const missing = await call(ctx, { method: 'POST', path: '/utils/revert/99999999', headers });

			await hostDb()('directus_revisions').where({ id: first.id }).update({ data: null });
			const noData = await call(ctx, { method: 'POST', path: `/utils/revert/${first.id}`, headers });

			return {
				reverted: snap(reverted, '/utils'),
				item,
				missing: snap(missing, '/utils'),
				noData: snap(noData, '/utils'),
			};
		});

		assertSameTranscripts(transcripts, 'revert');
		expect((transcripts.backoffice as any).item.title).toBe('first');
	});
});

describe('POST /utils/cache/clear', () => {
	it('admin only', async () => {
		await same({ method: 'POST', path: '/utils/cache/clear' });
		await same({ method: 'POST', path: '/utils/cache/clear', headers: bearer(limited) });
		await same({ method: 'POST', path: '/utils/cache/clear?system=false', headers: await admin() });
	});

	// A column and its field row written straight in the database (host DDL: full only, Postgres).
	it.runIf(full)('?system clears the schema of the other app too', async () => {
		for (const [writer, reader] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const field = `added_${writer}_${run}`;
			await hostDb().schema.alterTable(SORTED, (t) => t.string(field));
			await hostDb()('directus_fields').insert({ collection: SORTED, field });

			await appRequest(writer, 'POST', '/utils/cache/clear?system');
			const fields = await appRequest(reader, 'GET', `/fields/${SORTED}`);
			expect(
				fields.data.map((f: any) => f.field),
				`${writer} → ${reader}`,
			).toContain(field);
		}
	});
});

describe('POST /utils/resolve-redirect', () => {
	it('valid, missing, provider not a string, outside the allow list', async () => {
		await same({ method: 'POST', path: '/utils/resolve-redirect', body: { redirect: '/admin/content' } });
		await same({ method: 'POST', path: '/utils/resolve-redirect', body: {} });
		await same({ method: 'POST', path: '/utils/resolve-redirect', body: { redirect: '/admin', provider: 1 } });
		await same({ method: 'POST', path: '/utils/resolve-redirect', body: { redirect: 'https://evil.example.com/x' } });
	});
});

describe('POST /utils/translations/generate', () => {
	it('admin only; a bad payload answers the same 400', async () => {
		await same({ method: 'POST', path: '/utils/translations/generate', body: {} });
		await same({ method: 'POST', path: '/utils/translations/generate', headers: bearer(limited), body: {} });
		await same({
			method: 'POST',
			path: '/utils/translations/generate',
			headers: await admin(),
			body: { collection: 1 },
		});
	});

	it.runIf(full)('the same languages and translations collections, fields and relations at both apps', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const parent = `parity_tg_${run}_${ctx.app === 'directus' ? 'd' : 'b'}`;
			await appRequest('directus', 'POST', '/collections', {
				collection: parent,
				schema: {},
				meta: {},
				fields: [
					{
						field: 'id',
						type: 'integer',
						meta: { hidden: true },
						schema: { is_primary_key: true, has_auto_increment: true },
					},
					{ field: 'title', type: 'string', meta: {} },
				],
			});

			const res = await call(ctx, {
				method: 'POST',
				path: '/utils/translations/generate',
				headers: await admin(),
				body: { collection: parent, fields: ['title'], languagesCollection: `${parent}_languages` },
			});

			const rename = (value: unknown) => JSON.parse(JSON.stringify(value).replaceAll(parent, '<parent>'));
			const collections = await hostDb()('directus_collections')
				.select('collection', 'hidden', 'icon')
				.where('collection', 'like', `${parent}%`)
				.orderBy('collection');
			const fields = await hostDb()('directus_fields')
				.select('collection', 'field', 'special', 'interface', 'hidden')
				.where('collection', 'like', `${parent}%`)
				.orderBy(['collection', 'field']);
			const relations = await hostDb()('directus_relations')
				.select('many_collection', 'many_field', 'one_collection', 'one_field', 'junction_field')
				.where('many_collection', 'like', `${parent}%`)
				.orderBy(['many_collection', 'many_field']);

			for (const c of ['_translations', '_languages', '']) {
				await appRequest('directus', 'DELETE', `/collections/${parent}${c}`).catch(() => undefined);
			}

			return rename({ res: comparable(snap(res, '/utils')), collections, fields, relations });
		});

		assertSameTranscripts(transcripts, 'translations/generate');
	});
});
