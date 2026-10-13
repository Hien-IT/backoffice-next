// Feature 008, US2 (spec FR-030 to FR-039, contracts/versions.md): /versions at both apps. Errors go to both apps at
// once; the life of a version (create, save, read, compare, promote, delete) runs as a scenario at each app with the
// history rows it writes; a version made at one app is compared and promoted at the other (acceptance criterion);
// the hash of the main item is the same at both apps for every field type (research R2); R-20 and R-21 are measured.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { type AppName, appRequest } from '../directus-api.js';
import { capture } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createField,
	createPolicy,
	createUser,
	createUserCollection,
	type TestUser,
} from '../permissions/fixtures.js';
import { admin, BROWSER, call, historyCollection, same, snapHistory as snap, step } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_ver_posts_${run}`;
const LINKS = `parity_ver_links_${run}`;
const PLAIN = `parity_ver_plain_${run}`;
const TYPES = `parity_ver_types_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const full = process.env['PARITY_SUITE'] !== 'reduced';
const APPS: AppName[] = ['directus', 'backoffice'];

let editor: TestUser;
let existing: { item: string; version: string; empty: string };

beforeAll(async () => {
	await historyCollection(POSTS, { versioning: true });
	await createField(POSTS, { field: 'links', type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } });
	await createUserCollection(
		LINKS,
		[
			{ field: 'url', type: 'string' },
			{ field: 'post', type: 'uuid' },
		],
		{ primaryKey: 'uuid', meta: { accountability: 'all' } },
	);
	await appRequest('directus', 'POST', '/relations', {
		collection: LINKS,
		field: 'post',
		related_collection: POSTS,
		meta: { one_field: 'links' },
		schema: { on_delete: 'SET NULL' },
	});
	await historyCollection(PLAIN, { versioning: false });

	// Every field type whose value a vendor returns in its own way (research R2: same hash at both apps).
	await createUserCollection(
		TYPES,
		[
			{ field: 's', type: 'string', meta: {} },
			{ field: 't', type: 'text', meta: {} },
			{ field: 'i', type: 'integer', meta: {} },
			{ field: 'bi', type: 'bigInteger', meta: {} },
			{ field: 'f', type: 'float', meta: {} },
			{ field: 'd', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 3 }, meta: {} },
			{ field: 'b', type: 'boolean', meta: { special: ['cast-boolean'] } },
			// Every field has a meta, like the Directus app sends them: POST /collections fills `collection` and `field` of
			// each meta, then adds the cast flag of the dialect (json; timestamp on SQLite) to fields without one, as a meta
			// missing both, which fails validation.
			{ field: 'j', type: 'json', meta: { special: ['cast-json'] } },
			{ field: 'dt', type: 'dateTime', meta: {} },
			{ field: 'ts', type: 'timestamp', meta: {} },
			{ field: 'da', type: 'date', meta: {} },
			{ field: 'ti', type: 'time', meta: {} },
			{ field: 'u', type: 'uuid', meta: {} },
			{ field: 'c', type: 'csv', meta: { special: ['cast-csv'] } },
		],
		{ primaryKey: 'uuid', meta: { versioning: true, accountability: 'all' } },
	);

	const item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'main' })).data.id;
	const version = (
		await appRequest('directus', 'POST', '/versions', { key: 'taken', name: null, collection: POSTS, item })
	).data.id;
	const empty = (
		await appRequest('directus', 'POST', '/versions', { key: 'empty', collection: POSTS, item, name: 'e' })
	).data.id;
	existing = { item, version, empty };

	// R-20: may read posts and read, update versions, but not update posts.
	editor = await createUser('directus', 'ver-editor');
	const policy = await createPolicy('directus', 'ver-editor', {
		app: true,
		permissions: [
			{ collection: POSTS, action: 'read', fields: ['*'], permissions: {} },
			{ collection: 'directus_versions', action: 'read', fields: ['*'], permissions: {} },
			{ collection: 'directus_versions', action: 'update', fields: ['*'], permissions: {} },
		],
	});
	await attachPolicy('directus', policy, { user: editor.id });
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('errors at both apps (contracts/versions.md §2)', () => {
	it('create: payload, reserved key, item access, versioning, existing key, duplicates in one request', async () => {
		const headers = await admin();
		const valid = { key: 'k', name: 'n', collection: POSTS, item: existing.item };

		for (const body of [
			{ ...valid, key: undefined },
			{ ...valid, name: undefined, collection: undefined },
			{ ...valid, item: 1 },
			{ ...valid, extra: true },
			{ ...valid, key: 'main' },
			{ ...valid, item: '00000000-0000-4000-8000-000000000000' },
			{ ...valid, collection: PLAIN },
			{ ...valid, key: 'taken' },
			[valid, valid],
		]) {
			await same({ method: 'POST', path: '/versions', headers, body: body as any });
		}
	});

	it('update: only key and name, never "main" nor a taken key; promote: mainHash, no changes, stale hash', async () => {
		const headers = await admin();

		await same({ method: 'PATCH', path: `/versions/${existing.empty}`, headers, body: { delta: {} } });
		await same({ method: 'PATCH', path: `/versions/${existing.empty}`, headers, body: { key: 'main' } });
		await same({ method: 'PATCH', path: `/versions/${existing.empty}`, headers, body: { key: 'taken' } });
		await same({
			method: 'PATCH',
			path: '/versions',
			headers,
			body: { keys: [existing.empty, existing.version], data: { key: 'same' } },
		});
		await same({ method: 'POST', path: `/versions/${existing.empty}/promote`, headers, body: {} });
		await same({ method: 'POST', path: `/versions/${existing.empty}/promote`, headers, body: { mainHash: 'x' } });
		// A delta to promote (saving at both apps would stamp two different _date values).
		await appRequest('directus', 'POST', `/versions/${existing.version}/save`, { title: 'saved' });
		await same({ method: 'POST', path: `/versions/${existing.version}/promote`, headers, body: { mainHash: 'stale' } });
	});

	it('reads: list, SEARCH, one version, a version that does not exist, OPTIONS, HEAD', async () => {
		const headers = await admin();
		const filter = json({ collection: { _eq: POSTS } });

		// The list keeps _user and _date in the delta, one version maps them (spec FR-032).
		await same({ path: `/versions?filter=${filter}&sort=key&meta=*`, headers });
		await same({ method: 'SEARCH', path: '/versions', headers, body: { keys: [existing.version] } });
		await same({ path: `/versions/${existing.version}`, headers });
		await same({ path: '/versions/00000000-0000-4000-8000-000000000000', headers });

		for (const path of [
			'/versions',
			`/versions/${existing.version}`,
			`/versions/${existing.version}/compare`,
			`/versions/${existing.version}/save`,
		]) {
			await same({ method: 'OPTIONS', path });
		}

		await same({ method: 'HEAD', path: `/versions?filter=${filter}`, headers });
	});
});

function sortLinks<T>(snapshot: T): T {
	const main = (snapshot as any).body?.data?.main;
	if (Array.isArray(main?.links)) main.links.sort();
	return snapshot;
}

describe('the life of a version at each app (US2.1 to US2.6)', () => {
	it('create, save (field and o2m), read, compare, promote, delete: responses and history rows', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = { ...(await admin()), ...BROWSER };
			const item = (
				await appRequest(ctx.app, 'POST', `/items/${POSTS}`, { title: 'one', links: [{ url: 'https://a.example' }] })
			).data.id as string;
			const link = (await appRequest(ctx.app, 'GET', `/items/${LINKS}?filter=${json({ post: { _eq: item } })}`)).data[0]
				.id;
			const ids: Record<string, string> = { item, link };

			const created = await step(
				ctx,
				{ method: 'POST', path: '/versions', headers, body: { key: 'draft', name: 'Draft', collection: POSTS, item } },
				'/versions',
				ids,
				(j) => ({ version: j.data.id, hash: j.data.hash }),
			);
			Object.assign(ids, { version: created.json.data.id, hash: created.json.data.hash });

			const saved = await step(
				ctx,
				{ method: 'POST', path: `/versions/${ids['version']}/save`, headers, body: { title: 'two' } },
				'/versions/:pk/save',
				ids,
			);
			const relational = await step(
				ctx,
				{
					method: 'POST',
					path: `/versions/${ids['version']}/save`,
					headers,
					body: {
						links: {
							create: [{ url: 'https://b.example' }],
							update: [{ id: link, url: 'https://a2.example' }],
							delete: [],
						},
					},
				},
				'/versions/:pk/save',
				ids,
			);

			const one = snap(await call(ctx, { path: `/versions/${ids['version']}`, headers }), '/versions/:pk', ids);
			const read = snap(
				await call(ctx, {
					path: `/items/${POSTS}/${item}?version=draft&fields=id,title,links.url&deep=${json({ links: { _sort: ['url'] } })}`,
					headers,
				}),
				'/items/:collection/:pk',
				ids,
			);
			const compared = await call(ctx, { path: `/versions/${ids['version']}/compare`, headers });
			const mainHash = (compared.json as any).data.mainHash;

			// The promote creates the link of the delta: name it from the row it left.
			const promoted = await step(
				ctx,
				{ method: 'POST', path: `/versions/${ids['version']}/promote`, headers, body: { mainHash } },
				'/versions/:pk/promote',
				ids,
				async () => ({
					newLink: String((await hostDb()(LINKS).where({ post: item }).whereNot({ id: link }).first())?.['id']),
				}),
			);
			ids['newLink'] = String((await hostDb()(LINKS).where({ post: item }).whereNot({ id: link }).first())?.['id']);
			const after = await call(ctx, {
				path: `/items/${POSTS}/${item}?fields=id,title,links.url&deep=${json({ links: { _sort: ['url'] } })}`,
				headers,
			});
			const outdated = await call(ctx, { path: `/versions/${ids['version']}/compare`, headers });
			ids['hash2'] = (outdated.json as any).data.mainHash;

			const deleted = await step(
				ctx,
				{ method: 'DELETE', path: `/versions/${ids['version']}`, headers },
				'/versions/:pk',
				ids,
			);
			const leftRevisions = await hostDb()('directus_revisions').where({ version: ids['version'] }).count({ n: '*' });

			return {
				created: created.step,
				saved: saved.step,
				relational: relational.step,
				one,
				read,
				compared: snap(compared, '/versions/:pk/compare', ids),
				promoted: promoted.step,
				after: snap(after, '/items/:collection/:pk', ids),
				// main.links lists the o2m keys in primary key order (random uuids): sort the placeholders.
				outdated: sortLinks(snap(outdated, '/versions/:pk/compare', ids)),
				deleted: deleted.step,
				leftRevisions: Number(leftRevisions[0]!['n']),
			};
		});

		assertSameTranscripts(transcripts, 'version life');
		const d = transcripts.directus;
		// The save writes version_save for the item, then the sudo update of the delta tracks directus_versions itself.
		expect((d.saved.history as any).activity).toEqual([
			expect.objectContaining({ action: 'version_save', collection: POSTS, item: '<item>' }),
			expect.objectContaining({ action: 'update', collection: 'directus_versions', item: '<version>' }),
		]);
		expect((d.saved.history as any).revisions[0]).toMatchObject({
			activity: 0,
			version: 'key:draft',
			delta: { title: 'two' },
		});
		expect((d.compared.body as any).data.outdated).toBe(false);
		expect((d.outdated.body as any).data.outdated).toBe(true);
		expect(d.leftRevisions).toBe(0);
	});
});

describe('made at one app, promoted at the other (acceptance criterion, SC-003)', () => {
	it.each([
		['directus', 'backoffice'],
		['backoffice', 'directus'],
	] as const)('created and saved at %s, compared at both, promoted at %s', async (maker, promoter) => {
		const item = (await appRequest(maker, 'POST', `/items/${POSTS}`, { title: 'cross' })).data.id;
		const version = (
			await appRequest(maker, 'POST', '/versions', { key: `x-${maker}`, name: null, collection: POSTS, item })
		).data.id;
		await appRequest(maker, 'POST', `/versions/${version}/save`, { title: `from ${maker}` });

		const headers = await admin();
		const compared = await same({ path: `/versions/${version}/compare`, headers });
		const { mainHash, outdated } = (compared.directus.json as any).data;
		expect(outdated).toBe(false);

		const promoted = await appRequest(promoter, 'POST', `/versions/${version}/promote`, { mainHash });
		expect(promoted.data).toBe(item);

		for (const app of APPS) {
			expect((await appRequest(app, 'GET', `/items/${POSTS}/${item}`)).data.title).toBe(`from ${maker}`);
		}
	});

	it.runIf(full)('the hash of the main item is the same at both apps for every field type (research R2)', async () => {
		const item = (
			await appRequest('directus', 'POST', `/items/${TYPES}`, {
				s: 'text',
				t: 'long text',
				i: 42,
				bi: 9007199254740990,
				f: 1.5,
				d: 12.345,
				b: true,
				j: { a: [1, 'b'], c: null },
				dt: '2026-10-13T10:20:30',
				ts: '2026-10-13T10:20:30.000Z',
				da: '2026-10-13',
				ti: '10:20:30',
				u: '7d4b1c2e-0000-4000-8000-000000000001',
				c: ['x', 'y'],
			})
		).data.id;

		for (const maker of APPS) {
			const version = (
				await appRequest(maker, 'POST', '/versions', { key: `types-${maker}`, name: null, collection: TYPES, item })
			).data.id;

			const compared = await same({ path: `/versions/${version}/compare`, headers: await admin() });
			expect((compared.directus.json as any).data.outdated, `made at ${maker}`).toBe(false);
		}
	});
});

describe('risks reproduced from Directus (spec R-20, R-21)', () => {
	it.runIf(full)('R-20: a user who may not update the item saves a delta into its version at both apps', async () => {
		const out: Record<string, number> = {};

		for (const app of APPS) {
			const item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'locked' })).data.id;
			const version = (
				await appRequest('directus', 'POST', '/versions', { key: `r20-${app}`, name: null, collection: POSTS, item })
			).data.id;
			const res = await capture(urls()[app], {
				method: 'POST',
				path: `/versions/${version}/save`,
				headers: { authorization: `Bearer ${editor.token}` },
				body: { title: 'not allowed on the item' },
			});
			out[app] = res.status;
		}

		// Measured on Directus 11.17.4 (spec R-20): the save goes through, the main item is untouched.
		expect(out).toEqual({ directus: out['directus'], backoffice: out['directus'] });
		process.stdout.write(`R-20 save by a user without update on the item: ${JSON.stringify(out)}\n`);
	});

	it.runIf(full)('R-21: two promotes of one version at once, at each app', async () => {
		const outcome: Record<string, number[]> = {};

		for (const app of APPS) {
			const item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'race' })).data.id;
			const version = (
				await appRequest('directus', 'POST', '/versions', { key: `r21-${app}`, name: null, collection: POSTS, item })
			).data.id;
			await appRequest('directus', 'POST', `/versions/${version}/save`, { title: 'raced' });
			const { mainHash } = (await appRequest('directus', 'GET', `/versions/${version}/compare`)).data;
			const headers = await admin();
			const req = { method: 'POST', path: `/versions/${version}/promote`, headers, body: { mainHash } };
			const results = await Promise.all([capture(urls()[app], req), capture(urls()[app], req)]);
			outcome[app] = results.map((r) => r.status).sort();
		}

		// No lock in Directus: both may pass the hash check (200, 200), or the second sees the promoted item (200, 422).
		for (const statuses of Object.values(outcome)) {
			expect(statuses[0]).toBe(200);
			expect([200, 422]).toContain(statuses[1]);
		}

		process.stdout.write(`R-21 two promotes at once: ${JSON.stringify(outcome)}\n`);
	});
});
