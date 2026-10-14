import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiFetch, replaceQueue, requestEndpoint, sdk } from '../api/sdk.ts';
import { assertOnlyKnownRequests, calls, json, mockApi, mockFixtureApi } from './fetch.ts';
import { loadSnapshot, type FixtureUser } from './fixtures.ts';

beforeEach(async () => {
	setActivePinia(createPinia());
	// No rate limit in these tests (the app queue lets 5 requests through every 500 ms).
	await replaceQueue();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const snapshot = loadSnapshot();

const get = <T = any>(path: string, params: Record<string, unknown> = {}) =>
	sdk.request<T>(requestEndpoint(path, { method: 'GET', params }));

/** Status and body of a raw request (errors included). */
async function raw(path: string, init?: RequestInit) {
	const response = await apiFetch(path, init);
	return { status: response.status, body: await response.json() };
}

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

function setup(user: FixtureUser = 'admin') {
	return mockFixtureApi(snapshot, { user });
}

describe('mockApi', () => {
	test('answers data, functions and 404', async () => {
		const fetch = mockApi({ 'GET /a': [1], 'GET /b': () => json({ data: 'b' }, 201) });

		expect(await get('/a', { fields: ['id'] })).toEqual([1]);
		expect((await apiFetch('/b')).status).toBe(201);
		expect((await apiFetch('/c')).status).toBe(404);
		expect(calls(fetch)).toEqual(['GET /a?fields=id', 'GET /b', 'GET /c']);
	});
});

describe('mockFixtureApi hydrate routes', () => {
	test('answers as the chosen user', async () => {
		setup('bo-editor');

		expect(await get('/users/me', { fields: ['*', 'role.id'] })).toMatchObject({ email: 'bo-editor@example.com' });
		expect(await get('/policies/me/globals')).toEqual({ app_access: true, admin_access: false, enforce_tfa: false });
		expect(await get('/roles/me')).toEqual([{ id: snapshot.users['bo-editor'].me.role!.id }]);
		expect(await get('/permissions/me')).toEqual(snapshot.permissions['bo-editor']);
		expect((await get<any[]>('/fields')).some((f) => f.collection === 'directus_files')).toBe(true);
		expect((await get<any[]>('/collections')).map((c) => c.collection)).toContain('bo_std');
		expect(await get('/relations')).toEqual(snapshot.relations);
		expect(await get('/settings')).toMatchObject({ module_bar: null });
		expect(await get('/presets')).toEqual([]);
		expect(await get('/notifications', { aggregate: { count: 'id' } })).toEqual([{ count: { id: '0' } }]);
		expect(await get('/server/info')).toMatchObject({ queryLimit: { max: -1 } });
	});

	test('answers override routes', async () => {
		mockFixtureApi(snapshot, { answers: { 'GET /flows': () => json({ errors: [{ message: 'boom' }] }, 500) } });
		expect((await apiFetch('/flows')).status).toBe(500);
	});
});

describe('mockFixtureApi lists', () => {
	test('filters in memory', async () => {
		setup();
		const targets = (filter: unknown) => get<any[]>('/items/bo_rel_target', { filter, fields: ['name'] }).then(names);

		expect(await targets({ status: { _eq: 'draft' } })).toEqual(['Target two']);
		expect(await targets({ status: { _neq: 'published' } })).toEqual(['Target two', 'Target four']);
		expect(await targets({ id: { _in: [1, 2] } })).toEqual(['Target one', 'Target two']);
		expect(await targets({ id: { _nin: '1,2,3' } })).toEqual(['Target four', 'Target five']);
		expect(await targets({ o2m_list_parent: { _null: true } })).toHaveLength(3);
		expect(await targets({ o2m_list_parent: { _nnull: true } })).toEqual(['Target two', 'Target three']);
		expect(await targets({ _or: [{ id: { _eq: 1 } }, { name: { _contains: 'five' } }] })).toEqual([
			'Target one',
			'Target five',
		]);
		expect(await targets({ _and: [{ status: { _eq: 'published' } }, { id: { _gt: 1 } }] })).toEqual([
			'Target three',
			'Target five',
		]);
		// Relational filter on the m2o side.
		expect(await targets({ o2m_list_parent: { title: { _eq: 'Target' } } })).toEqual(['Target two', 'Target three']);
		await expect(targets({ id: { _regex: 'x' } })).rejects.toThrow('unsupported filter operator _regex');
	});

	test('reads the bracket notation too', async () => {
		setup();
		const { body } = await raw('/items/bo_rel_target?filter[status][_eq]=draft&fields=id');
		expect(body).toEqual({ data: [{ id: 2 }] });
	});

	test('searches strings and numbers, sorts, pages and counts', async () => {
		setup();

		expect(names(await get('/items/bo_rel_target', { search: 'THREE' }))).toEqual(['Target three']);
		// Like Directus: a number matches every numeric field (id 1 and the rows whose parent is 1).
		expect(names(await get('/items/bo_rel_target', { search: '1' }))).toEqual([
			'Target one',
			'Target two',
			'Target three',
			'Target four',
		]);
		expect(names(await get('/items/bo_rel_target', { sort: ['-name'], limit: 2, page: 2 }))).toEqual([
			'Target one',
			'Target four',
		]);
		expect(names(await get('/items/bo_rel_target', { sort: ['o2m_list_parent', 'id'], limit: 3 }))).toEqual([
			'Target two',
			'Target three',
			'Target one',
		]);
		expect(await get('/items/bo_rel_target', { aggregate: { count: '*' }, search: 'Target' })).toEqual([
			{ count: '5' },
		]);
		expect(await get('/items/bo_rel_target', { aggregate: { countDistinct: 'status' } })).toEqual([
			{ countDistinct: { status: '3' } },
		]);
		await expect(get('/items/bo_rel_target', { aggregate: { sum: 'id' } })).rejects.toThrow(
			'unsupported aggregate sum',
		);
	});

	test('expands fields one level, with m2a scopes and aliases', async () => {
		setup();

		const [row] = await get<any[]>('/items/bo_rel', {
			fields: [
				'id',
				'm2o.name',
				'o2m_list.name',
				'files.directus_files_id',
				'm2a.collection',
				'm2a.item:bo_m2a_a.name',
				'owner',
			],
			filter: { id: { _eq: 1 } },
		});

		expect(row).toEqual({
			id: 1,
			m2o: { name: 'Target one' },
			o2m_list: [{ name: 'Target two' }, { name: 'Target three' }],
			files: [
				{ directus_files_id: expect.stringMatching(/^bo-/) },
				{ directus_files_id: expect.stringMatching(/^bo-/) },
			],
			m2a: [
				{ collection: 'bo_m2a_a', item: { name: 'A one' } },
				{ collection: 'bo_m2a_b', item: expect.stringMatching(/^bo-/) },
			],
			owner: snapshot.users['bo-editor'].me.id,
		});

		const [aliased] = await get<any[]>('/items/bo_rel', {
			fields: ['target.name'],
			alias: { target: 'm2o' },
			limit: 1,
		});
		expect(aliased).toEqual({ target: { name: 'Target one' } });

		const [all] = await get<any[]>('/items/bo_rel', { fields: ['*', 'file.*'], limit: 1 });
		expect(all.m2o).toBe(1);
		expect(all.m2m_list).toEqual([1, 2, 3]);
		expect(all.file.type).toBe('application/pdf');
	});

	test('reads one item; a missing key is forbidden like Directus', async () => {
		setup();

		expect(await get('/items/bo_languages/vi-VN', { fields: ['name'] })).toEqual({ name: 'Tiếng Việt' });
		expect(await get(`/files/${snapshot.files[0]!['id']}`, { fields: ['type'] })).toEqual({ type: 'application/pdf' });
		expect(await raw('/items/bo_rel_target/99')).toMatchObject({
			status: 403,
			body: { errors: [{ extensions: { code: 'FORBIDDEN' } }] },
		});
	});
});

describe('mockFixtureApi permissions', () => {
	test('the editor cannot ask for a field it cannot read; * leaves it out', async () => {
		setup('bo-editor');

		expect((await raw('/items/bo_rel_target?fields=id,status')).status).toBe(403);
		expect((await raw('/items/bo_rel?fields=m2o.status')).status).toBe(403);
		expect((await raw('/items/bo_rel_target?filter={"status":{"_eq":"draft"}}')).status).toBe(403);
		expect(Object.keys((await get<any[]>('/items/bo_rel_target', { limit: 1 }))[0])).not.toContain('status');
		expect((await get<any[]>('/users')).map((u) => u.email)).toEqual(['bo-editor@example.com']);
	});

	test('the viewer cannot read flows', async () => {
		setup('bo-viewer');
		expect((await raw('/flows')).status).toBe(403);
		expect((await get<any[]>('/items/bo_groups')).length).toBe(2);
	});
});

describe('mockFixtureApi writes and assets', () => {
	test('POST /files adds a row, POST /files/import too, flows echo their trigger', async () => {
		const fetch = setup();
		const folder = snapshot.files[0]!['folder'];

		const form = new FormData();
		form.append('folder', folder);
		form.append('title', 'New');
		form.append('file', new File(['abc'], 'new.txt', { type: 'text/plain' }));
		const created = (await raw('/files', { method: 'POST', body: form })).body.data;

		expect(created).toMatchObject({
			id: 'bo-new-1',
			title: 'New',
			folder,
			type: 'text/plain',
			filename_download: 'new.txt',
		});

		const imported = (
			await raw('/files/import', {
				method: 'POST',
				body: JSON.stringify({ url: 'https://example.com/a.png', data: { folder } }),
			})
		).body.data;

		expect(imported).toMatchObject({ id: 'bo-new-2', filename_download: 'a.png', folder });
		expect(await get('/files', { filter: { folder: { _eq: folder } }, aggregate: { count: '*' } })).toEqual([
			{ count: '5' },
		]);
		expect(fetch.db['directus_files']).toHaveLength(5);

		const flow = snapshot.flows[0]!.id;
		const triggered = await raw(`/flows/trigger/${flow}`, {
			method: 'POST',
			body: JSON.stringify({ collection: 'bo_groups', keys: [1] }),
		});
		expect(triggered.body.data).toMatchObject({ body: { collection: 'bo_groups', keys: [1] }, method: 'POST' });

		const asset = await apiFetch(`/assets/${folder}`);
		expect(asset.headers.get('Content-Type')).toBe('image/png');
		expect((await raw('/nothing')).status).toBe(404);

		expect(() => assertOnlyKnownRequests(calls(fetch).filter((c) => !c.includes('/nothing')))).not.toThrow();
	});
});

describe('assertOnlyKnownRequests', () => {
	test('accepts the 012 and 013 routes, rejects the others', () => {
		expect(() =>
			assertOnlyKnownRequests([
				'GET /fields',
				'GET /items/bo_std?fields=*',
				'GET /items/bo_std/1',
				'GET /users/abc?fields=id',
				'GET /assets/abc.png?access_token=x',
				'POST /files',
				'POST /files/import',
				'POST /flows/trigger/abc',
			]),
		).not.toThrow();

		expect(() => assertOnlyKnownRequests(['GET /fields', 'PATCH /items/bo_std/1', 'DELETE /files'])).toThrow(
			'Requests outside contracts/api-calls.md:\nPATCH /items/bo_std/1\nDELETE /files',
		);
		expect(() => assertOnlyKnownRequests(['GET /search?q=a'], [/^\/search$/])).not.toThrow();
	});
});
