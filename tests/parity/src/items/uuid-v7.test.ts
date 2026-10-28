// Spec 027 (D-192): Backoffice gives the special uuid fields of user collections a UUID v7, in creation order within
// one instance; Directus 11.17.4 a v4. System collections keep v4 and values sent by the client stay as sent. Writes
// are checked at each app on its own items (generated ids differ anyway); reads of the shared DB go to both apps at
// once (parity()).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppName, adminToken, appRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { assertParity, type ParityRequest, parity } from '../parity.js';
import { cleanup, createField, createUserCollection } from '../permissions/fixtures.js';

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION: Record<AppName, RegExp> = { directus: V4, backoffice: V7 };
const APPS: AppName[] = ['directus', 'backoffice'];

const [vendor] = getDbsToTest();
const run = Math.random().toString(16).slice(2, 10);
const MAIN = `parity_uuid7_${run}`;
const CHILD = `parity_uuid7_child_${run}`;
const FILES = `parity_uuid7_files_${run}`;
const BLOCKS = `parity_uuid7_blocks_${run}`;
const ORDER = `parity_uuid7_order_${run}`;
const SINGLE: Record<AppName, string> = {
	directus: `parity_uuid7_s_dir_${run}`,
	backoffice: `parity_uuid7_s_bac_${run}`,
};

const made = { files: [] as string[], folders: [] as string[], roles: [] as string[], policies: [] as string[] };
let admin = '';

/** The same request to both apps as the admin (a token of Directus works at Backoffice: same SECRET). */
const asAdmin = (req: ParityRequest) => parity({ ...req, headers: { authorization: admin, ...req.headers } });

/** A read of the shared DB: both apps answer 200 and the same body. */
async function sameRead(path: string) {
	const result = await asAdmin({ path });
	expect([result.directus.status, result.backoffice.status]).toEqual([200, 200]);
	assertParity(result);
	return (result.backoffice.json as { data: unknown }).data;
}
const invited: string[] = [];

const relation = (body: Record<string, unknown>) => appRequest('directus', 'POST', '/relations', body);
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);
const increasing = (values: string[]) => values.every((value, i) => i === 0 || value > values[i - 1]!);
/** A UUID with the version digit of a v7, as a client could send one. */
const asV7 = (uuid: string) => `${uuid.slice(0, 14)}7${uuid.slice(15)}`;

const csv = (text: string) => {
	const form = new FormData();
	form.append('file', new Blob([text], { type: 'text/csv' }), 'import.csv');
	return form;
};

beforeAll(async () => {
	admin = `Bearer ${await adminToken('directus')}`;

	await createUserCollection(
		MAIN,
		[
			{ field: 'title', type: 'string' },
			{ field: 'code', type: 'uuid', meta: { special: ['uuid'] } },
			{ field: 'folder', type: 'uuid' },
		],
		{ primaryKey: 'uuid' },
	);
	await relation({
		collection: MAIN,
		field: 'folder',
		related_collection: 'directus_folders',
		schema: { on_delete: 'SET NULL' },
	});

	// o2m
	await createUserCollection(
		CHILD,
		[
			{ field: 'title', type: 'string' },
			{ field: 'parent', type: 'uuid' },
		],
		{ primaryKey: 'uuid' },
	);
	await createField(MAIN, { field: 'children', type: 'alias', meta: { special: ['o2m'] } });
	await relation({
		collection: CHILD,
		field: 'parent',
		related_collection: MAIN,
		meta: { one_field: 'children' },
		schema: { on_delete: 'SET NULL' },
	});

	// m2m to a system collection: the junction is a user collection.
	await createUserCollection(
		FILES,
		[
			{ field: 'item_id', type: 'uuid' },
			{ field: 'directus_files_id', type: 'uuid' },
		],
		{ primaryKey: 'uuid' },
	);
	await createField(MAIN, { field: 'files', type: 'alias', meta: { special: ['m2m'] } });
	await relation({
		collection: FILES,
		field: 'item_id',
		related_collection: MAIN,
		meta: { one_field: 'files', junction_field: 'directus_files_id' },
		schema: { on_delete: 'CASCADE' },
	});
	await relation({
		collection: FILES,
		field: 'directus_files_id',
		related_collection: 'directus_files',
		meta: { junction_field: 'item_id' },
		schema: { on_delete: 'SET NULL' },
	});

	// m2a
	await createUserCollection(
		BLOCKS,
		[
			{ field: 'item_id', type: 'uuid' },
			{ field: 'item', type: 'string' },
			{ field: 'collection', type: 'string' },
		],
		{ primaryKey: 'uuid' },
	);
	await createField(MAIN, { field: 'blocks', type: 'alias', meta: { special: ['m2a'] } });
	await relation({
		collection: BLOCKS,
		field: 'item',
		related_collection: null,
		meta: { one_allowed_collections: [CHILD], one_collection_field: 'collection', junction_field: 'item_id' },
	});
	await relation({
		collection: BLOCKS,
		field: 'item_id',
		related_collection: MAIN,
		meta: { one_field: 'blocks', junction_field: 'item' },
		schema: { on_delete: 'CASCADE' },
	});

	await createUserCollection(ORDER, [{ field: 'title', type: 'string' }], { primaryKey: 'uuid' });

	for (const name of Object.values(SINGLE)) {
		await createUserCollection(name, [{ field: 'headline', type: 'string' }], {
			primaryKey: 'uuid',
			meta: { singleton: true },
		});
	}

	const form = new FormData();
	form.append('file', new Blob(['parity uuid v7'], { type: 'text/plain' }), 'uuid-v7.txt');
	made.files.push((await appRequest('directus', 'POST', '/files', form)).data.id);
}, 300_000);

afterAll(async () => {
	if (invited.length) {
		const { data } = await appRequest(
			'directus',
			'GET',
			`/users?filter=${json({ email: { _in: invited } })}&fields=id&limit=-1`,
		);
		if (data.length) await appRequest('directus', 'DELETE', '/users', idsOf(data));
	}

	await cleanup();

	for (const id of made.files) await appRequest('directus', 'DELETE', `/files/${id}`);
	if (made.folders.length) await appRequest('directus', 'DELETE', '/folders', made.folders);
	if (made.policies.length) await appRequest('directus', 'DELETE', '/policies', made.policies);
	if (made.roles.length) await appRequest('directus', 'DELETE', '/roles', made.roles);
}, 300_000);

describe('user collections get a UUID v7 at Backoffice (US1)', () => {
	it('one item and a batch: v7 in sending order at Backoffice, v4 at Directus, the rest of the body the same', async () => {
		const rest: Partial<Record<AppName, unknown>> = {};

		for (const app of APPS) {
			const one = (await appRequest(app, 'POST', `/items/${MAIN}`, { title: `one-${app}` })).data;
			expect(one.id).toMatch(VERSION[app]);
			expect(one.code).toMatch(VERSION[app]);
			const { id: _id, code: _code, title: _title, ...others } = one;
			rest[app] = others;

			const titles = ['b1', 'b2', 'b3'].map((t) => `${t}-${app}`);
			const batch = (await appRequest(app, 'POST', `/items/${MAIN}`, titles.map((title) => ({ title })))).data;

			for (const item of batch) {
				expect(item.id).toMatch(VERSION[app]);
				expect(item.code).toMatch(VERSION[app]);
			}

			// FR-009: the batch is read back by primary key, so Backoffice returns it in sending order.
			if (app === 'backoffice') {
				expect(batch.map((item: { title: string }) => item.title)).toEqual(titles);
				expect(increasing(idsOf(batch))).toBe(true);
			}
		}

		expect(rest.backoffice).toEqual(rest.directus);
	});

	it('GraphQL create and import at Backoffice; an id in the file is kept (FR-002, FR-005)', async () => {
		const gql = await appRequest('backoffice', 'POST', '/graphql', {
			query: `mutation {
				one: create_${MAIN}_item(data: { title: "g1" }) { id code }
				many: create_${MAIN}_items(data: [{ title: "g2" }, { title: "g3" }]) { id title }
			}`,
		});

		expect(gql.errors).toBeUndefined();
		expect(gql.data.one.id).toMatch(V7);
		expect(gql.data.one.code).toMatch(V7);
		expect(gql.data.many.map((item: { title: string }) => item.title)).toEqual(['g2', 'g3']);
		for (const item of gql.data.many) expect(item.id).toMatch(V7);
		expect(increasing(idsOf(gql.data.many))).toBe(true);

		const given = randomUUID();
		await appRequest('backoffice', 'POST', `/utils/import/${MAIN}`, csv('title\nimp-a\nimp-b\n'));
		await appRequest('backoffice', 'POST', `/utils/import/${MAIN}`, csv(`id,title\n,imp-c\n${given},imp-d\n`));

		const { data } = await appRequest(
			'backoffice',
			'GET',
			`/items/${MAIN}?filter=${json({ title: { _starts_with: 'imp-' } })}&fields=id,title&sort=title`,
		);

		expect(data.map((row: { title: string }) => row.title)).toEqual(['imp-a', 'imp-b', 'imp-c', 'imp-d']);
		for (const row of data.slice(0, 3)) expect(row.id).toMatch(V7);
		expect(data[3].id).toBe(given);
	});

	it('nested items follow their own collection: o2m child, m2m and m2a junctions v7, folder v4 (clarify 2)', async () => {
		const item = (
			await appRequest(
				'backoffice',
				'POST',
				`/items/${MAIN}?fields=id,folder,children.id,files.id,files.directus_files_id,blocks.id,blocks.item`,
				{
					title: 'nested',
					folder: { name: `parity-uuid7-${run}` },
					children: [{ title: 'child' }],
					files: [{ directus_files_id: made.files[0] }],
					blocks: [{ collection: CHILD, item: { title: 'block' } }],
				},
			)
		).data;

		made.folders.push(item.folder);
		expect(item.id).toMatch(V7);
		expect(item.folder).toMatch(V4);
		expect(item.children[0].id).toMatch(V7);
		expect(item.files[0].id).toMatch(V7);
		expect(item.files[0].directus_files_id).toBe(made.files[0]);
		expect(item.blocks[0].id).toMatch(V7);
		expect(item.blocks[0].item).toMatch(V7);
	});

	it('the first PATCH of a singleton creates its item with the id version of the app', async () => {
		for (const app of APPS) {
			const { data } = await appRequest(app, 'PATCH', `/items/${SINGLE[app]}`, { headline: 'first' });
			expect(data.id).toMatch(VERSION[app]);
		}
	});

	it('sort=id returns the creation order, except on MSSQL (FR-003, FR-011, research R5)', async () => {
		const titles = Array.from({ length: 30 }, (_, i) => `o-${String(i).padStart(2, '0')}`);
		for (const title of titles) await appRequest('backoffice', 'POST', `/items/${ORDER}`, { title });

		const rows = (await sameRead(`/items/${ORDER}?sort=id&fields=title&limit=-1`)) as { title: string }[];
		const sorted = rows.map((row) => row.title);

		// SQL Server compares the last six bytes of a uniqueidentifier first, where a UUID v7 holds random bits.
		if (vendor === 'mssql') expect(sorted).not.toEqual(titles);
		else expect(sorted).toEqual(titles);
	});
});

describe('values sent by the client stay (US2)', () => {
	it('a client id of any version is kept; a malformed one fails like Directus (FR-005)', async () => {
		for (const app of APPS) {
			for (const id of [randomUUID(), asV7(randomUUID())]) {
				const { data } = await appRequest(app, 'POST', `/items/${MAIN}`, { id, title: `client-${app}` });
				expect(data.id).toBe(id);
			}
		}

		const bad = await asAdmin({ method: 'POST', path: `/items/${MAIN}`, body: { id: 'not-a-uuid', title: 'bad' } });
		expect(bad.backoffice.status).toBeGreaterThanOrEqual(400);
		assertParity(bad);
	});

	it('an update never generates a value (FR-006)', async () => {
		for (const app of APPS) {
			const item = (await appRequest(app, 'POST', `/items/${MAIN}`, { title: `patch-${app}` })).data;

			const kept = (await appRequest(app, 'PATCH', `/items/${MAIN}/${item.id}`, { title: 'patched' })).data;
			expect([kept.id, kept.code]).toEqual([item.id, item.code]);

			const cleared = (await appRequest(app, 'PATCH', `/items/${MAIN}/${item.id}`, { code: null })).data;
			expect(cleared.id).toBe(item.id);
			expect(cleared.code).toBeNull();
		}
	});
});

describe('system collections keep a UUID v4 (US3)', () => {
	it('roles, policies, folders made at Backoffice are v4; both apps invite with such a role (FR-004, SC-003)', async () => {
		const role = (await appRequest('backoffice', 'POST', '/roles', { name: `parity-uuid7-${run}` })).data.id;
		made.roles.push(role);
		const policy = (await appRequest('backoffice', 'POST', '/policies', { name: `parity-uuid7-${run}` })).data.id;
		made.policies.push(policy);
		const folder = (await appRequest('backoffice', 'POST', '/folders', { name: `parity-uuid7-top-${run}` })).data.id;
		made.folders.push(folder);

		for (const id of [role, policy, folder]) expect(id).toMatch(V4);

		// POST /users/invite accepts a uuidv4 role only (Joi), at both apps.
		for (const app of APPS) {
			const email = `parity-uuid7-${run}-${app}@example.com`;
			invited.push(email);
			await appRequest(app, 'POST', '/users/invite', { email, role });
		}
	});
});

describe('both apps read and write each other items (US4)', () => {
	it('v4 and v7 items read the same at both apps; each app updates and deletes the other one (FR-009, FR-010)', async () => {
		const item: Partial<Record<AppName, { id: string }>> = {};

		for (const app of APPS) {
			item[app] = (
				await appRequest(app, 'POST', `/items/${MAIN}`, { title: `cross-${app}`, children: [{ title: 'cross' }] })
			).data;
		}

		const both = [item.backoffice!.id, item.directus!.id];

		for (const path of [
			`/items/${MAIN}/${item.backoffice!.id}?fields=id,title,code,children.title`,
			`/items/${MAIN}/${item.directus!.id}?fields=id,title,code,children.title`,
			`/items/${MAIN}?filter=${json({ id: { _eq: item.backoffice!.id } })}&fields=id,title`,
			`/items/${MAIN}?filter=${json({ id: { _in: both } })}&fields=id,title&sort=-id`,
		]) {
			await sameRead(path);
		}

		await appRequest('directus', 'PATCH', `/items/${MAIN}/${item.backoffice!.id}`, { title: 'by-directus' });
		await appRequest('backoffice', 'PATCH', `/items/${MAIN}/${item.directus!.id}`, { title: 'by-backoffice' });
		const titles = (await sameRead(`/items/${MAIN}?filter=${json({ id: { _in: both } })}&fields=title&sort=title`)) as {
			title: string;
		}[];
		expect(titles.map((row) => row.title)).toEqual(['by-backoffice', 'by-directus']);

		await appRequest('directus', 'DELETE', `/items/${MAIN}/${item.backoffice!.id}`);
		await appRequest('backoffice', 'DELETE', `/items/${MAIN}/${item.directus!.id}`);

		expect(await sameRead(`/items/${MAIN}?filter=${json({ id: { _in: both } })}&fields=id`)).toEqual([]);
	});
});
