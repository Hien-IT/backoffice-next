import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiFetch, replaceQueue, requestEndpoint, sdk } from '../api/sdk.ts';
import { assertOnlyKnownRequests, calls, json, mockApi, mockFixtureApi } from './fetch.ts';
import { loadSnapshot, type FixtureUser, type Row } from './fixtures.ts';

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
		// The Content module presets and bookmarks of the fixture set (014).
		expect(await get('/presets')).toHaveLength(snapshot.presets.length);
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

	test('to-many filters: `{ field: value }` shorthand, _some / _none on o2m and m2m, $FOLLOW (o2m and o2a)', async () => {
		setup();
		const list = (path: string, filter: unknown) =>
			get<any[]>(path, { filter, fields: ['id'] }).then((rows) => rows.map((r) => r.id));

		// Shorthand equality, as use-relation-multiple sends the reverse junction field.
		expect(await list('/items/bo_rel_target', { o2m_table_parent: 1 })).toEqual([4]);
		// o2m alias: the rows pointing at the row.
		expect(await list('/items/bo_rel', { o2m_list: { _some: { id: { _eq: 2 } } } })).toEqual([1]);
		expect(await list('/items/bo_rel', { o2m_list: { name: { _eq: 'Target two' } } })).toEqual([1]);
		expect(await list('/items/bo_rel', { o2m_list: { _none: { id: { _eq: 2 } } } })).not.toContain(1);
		// m2m alias (junction rows), then through the junction to the related item.
		expect(await list('/items/bo_rel', { m2m_list: { _some: { bo_rel_target_id: { id: { _eq: 5 } } } } })).toEqual([1]);
		// $FOLLOW: the select drawer filters of list-m2m / files (o2m) and list-m2a (o2a with the collection field).
		const m2m = '$FOLLOW(bo_junction_m2m_list,bo_rel_target_id)';
		expect(await list('/items/bo_rel_target', { [m2m]: { _none: { bo_rel_id: { _eq: 1 } } } })).toEqual([2, 3, 4]);
		expect(await list('/items/bo_rel_target', { [m2m]: { _some: { bo_rel_id: { _eq: 1 } } } })).toEqual([1, 5]);
		const m2a = '$FOLLOW(bo_junction_m2a,item,collection)';
		const none = { [m2a]: { _none: { _and: [{ bo_rel_id: { _eq: 1 } }, { collection: { _eq: 'bo_m2a_a' } }] } } };
		expect(await list('/items/bo_m2a_a', none)).toHaveLength(1);
		// 014 calendar: _between includes both ends.
		expect(await list('/items/bo_rel_target', { id: { _between: [2, 4] } })).toEqual([2, 3, 4]);
		expect(await list('/items/bo_rel_target', { id: { _nbetween: [2, 4] } })).toEqual([1, 5]);
		// 014 map: every bo_content point is in Hanoi (105.8, 21.0).
		const box = (x: number) => ({
			type: 'Polygon',
			coordinates: [
				[
					[x, 20],
					[x + 1, 20],
					[x + 1, 22],
					[x, 22],
					[x, 20],
				],
			],
		});
		expect((await list('/items/bo_content', { location: { _intersects_bbox: box(105) } })).length).toBeGreaterThan(0);
		expect(await list('/items/bo_content', { location: { _intersects_bbox: box(0) } })).toEqual([]);
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
		// 3 files of bo-fixtures (013) + the 2 new ones + the bo-files tree of 015.
		expect(fetch.db['directus_files']).toHaveLength(5 + snapshot.directoryFiles.length);

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
	test('accepts the 012 to 015 routes, rejects the others', () => {
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
				'PATCH /files/abc',
				'DELETE /files',
				'POST /assets/folder/abc',
				'HEAD /files/tus/abc',
			]),
		).not.toThrow();

		expect(() => assertOnlyKnownRequests(['GET /fields', 'PATCH /fields/bo_std/a', 'DELETE /roles'])).toThrow(
			'Requests outside contracts/api-calls.md:\nPATCH /fields/bo_std/a\nDELETE /roles',
		);
		expect(() => assertOnlyKnownRequests(['GET /search?q=a'], [/^\/search$/])).not.toThrow();
	});
});

describe('mockFixtureApi Content module routes (014)', () => {
	const send = (path: string, method: string, body?: unknown) =>
		sdk.request<any>(
			requestEndpoint(path, { method: method as never, ...(body === undefined ? {} : { body: body as never }) }),
		);

	test('presets: create, update and delete with an array body', async () => {
		const fetch = setup();

		const created = await send('/presets', 'POST', { collection: 'bo_std', layout: 'tabular' });
		expect(created.id).toBeGreaterThan(1000);

		await send(`/presets/${created.id}`, 'PATCH', { search: 'x' });
		expect(fetch.db['directus_presets']!.find((p) => p['id'] === created.id)?.['search']).toBe('x');

		await sdk.request(requestEndpoint('/presets', { method: 'DELETE', body: [created.id] }));
		expect(fetch.db['directus_presets']!.some((p) => p['id'] === created.id)).toBe(false);
		assertOnlyKnownRequests(calls(fetch));
	});

	test('items: create, update one, update many by keys, delete many; singleton read and update', async () => {
		const fetch = setup();

		const created = await send('/items/bo_content', 'POST', { title: 'New', status: 'draft' });
		await send(`/items/bo_content/${created.id}`, 'PATCH', { title: 'Newer' });
		await send('/items/bo_content', 'PATCH', { keys: [1, 2], data: { status: 'archived' } });
		await sdk.request(requestEndpoint('/items/bo_content', { method: 'DELETE', body: [created.id] }));

		const rows = fetch.db['bo_content']!;
		expect(rows.find((r) => r['id'] === 1)?.['status']).toBe('archived');
		expect(rows.find((r) => r['id'] === 2)?.['status']).toBe('archived');
		expect(rows.some((r) => r['id'] === created.id)).toBe(false);

		expect((await get('/items/bo_singleton')).site_name).toBe('Backoffice fixtures');
		await send('/items/bo_singleton', 'PATCH', { site_name: 'Changed' });
		expect((await get('/items/bo_singleton')).site_name).toBe('Changed');
		assertOnlyKnownRequests(calls(fetch));
	});

	test('counts follow the filter (archive filter of the Content module)', async () => {
		setup();

		const [all] = await get('/items/bo_content', { aggregate: { countDistinct: 'id' } });
		const [active] = await get('/items/bo_content', {
			aggregate: { countDistinct: 'id' },
			filter: { status: { _neq: 'archived' } },
		});

		expect(all.countDistinct.id).toBe('30');
		expect(active.countDistinct.id).toBe('20');
	});

	test('versions: compare, save and promote', async () => {
		const fetch = setup();
		const draft = snapshot.versions.find((v) => v['key'] === 'draft')!;

		const comparison = await get(`/versions/${draft['id']}/compare`);
		expect(comparison).toMatchObject({ outdated: false, mainHash: 'bo-hash' });
		expect(comparison.current.title).toBe('Content 01 (draft)');

		await send(`/versions/${draft['id']}/save`, 'POST', { body: 'Draft body' });
		await send(`/versions/${draft['id']}/promote`, 'POST', { mainHash: 'bo-hash', fields: ['title'] });

		const item = fetch.db['bo_content']!.find((r) => r['id'] === 1)!;
		expect(item['title']).toBe('Content 01 (draft)');
		expect(item['body']).not.toBe('Draft body');
		assertOnlyKnownRequests(calls(fetch));
	});

	test('manual sort moves the item and renumbers the sort field', async () => {
		const fetch = setup();

		await send('/utils/sort/bo_content', 'POST', { item: 3, to: 1 });

		const order = [...fetch.db['bo_content']!].sort((a, b) => a['sort'] - b['sort']).map((r) => r['id']);
		expect(order.slice(0, 3)).toEqual([3, 1, 2]);
	});

	test('item permissions follow the collection permissions of the user', async () => {
		setup('bo-editor');

		expect(await get('/permissions/me/bo_content/1')).toEqual({
			update: { access: true },
			delete: { access: false },
			share: { access: false },
		});
	});

	test('GraphQL <collection>_by_id answers the item (save as copy)', async () => {
		setup();

		const result = await send('/graphql', 'POST', { query: 'query { item: bo_content_by_id (id: 2) { id title } }' });
		expect(result.item.title).toBe('Content 02');
	});

	test('export=csv answers a CSV body', async () => {
		setup();

		const response = await apiFetch('/items/bo_content?export=csv&fields=title&limit=2&sort=id');
		expect(await response.text()).toBe('"title"\n"Content 01 (edited)"\n"Content 02"');
	});
});

describe('mockFixtureApi, feature 015', () => {
	test('serves the bo-files folders, files, roles and directory users; filters files by folder', async () => {
		mockFixtureApi(loadSnapshot());
		const get = async (path: string) => (await (await globalThis.fetch(`http://api.test${path}`)).json()).data;

		const folders = (await get('/folders')) as { id: string; name: string }[];
		expect(folders.map((f) => f.name)).toEqual(expect.arrayContaining(['bo-files', 'bo-files-sub', 'bo-files-deep']));

		const root = folders.find((f) => f.name === 'bo-files')!;
		const files = (await get(`/files?filter=${encodeURIComponent(JSON.stringify({ folder: { _eq: root.id } }))}&limit=-1`)) as unknown[];
		expect(files).toHaveLength(31);

		expect(((await get('/roles')) as { name: string }[]).map((r) => r.name)).toContain('bo-sub');
		expect(((await get('/users?limit=-1')) as { email: string }[]).map((u) => u.email)).toContain('bo-invited@example.com');
		expect(await get('/utils/random/string')).toMatch(/^bo-random-/);
	});

	test('invite creates invited users and answers RECORD_NOT_UNIQUE for known emails', async () => {
		mockFixtureApi(loadSnapshot());
		const response = await globalThis.fetch('http://api.test/users/invite', {
			method: 'POST',
			body: JSON.stringify({ email: ['new@example.com', 'bo-active@example.com'], role: 'r1' }),
		});

		expect(response.status).toBe(400);
		expect((await response.json()).errors[0].extensions).toMatchObject({ code: 'RECORD_NOT_UNIQUE', invalid: 'bo-active@example.com' });

		const users = (await (await globalThis.fetch('http://api.test/users?limit=-1')).json()).data as Row[];
		expect(users.find((u) => u['email'] === 'new@example.com')).toMatchObject({ status: 'invited', role: 'r1' });
	});

	test('a multipart PATCH replaces the file; zips answer with a file name; serverInfo is merged', async () => {
		mockFixtureApi(loadSnapshot(), { serverInfo: { uploads: { tus: false, maxConcurrency: 5 } } });
		const files = (await (await globalThis.fetch('http://api.test/files?limit=-1')).json()).data as Row[];
		const id = files.find((f) => f['title'] === 'bo-edit')!['id'];

		const form = new FormData();
		form.append('file', new File(['x'], 'new.png', { type: 'image/png' }));
		const patched = (await (await globalThis.fetch(`http://api.test/files/${id}`, { method: 'PATCH', body: form })).json()).data;
		expect(patched).toMatchObject({ id, filename_download: 'new.png', type: 'image/png' });

		const zip = await globalThis.fetch('http://api.test/assets/files', { method: 'POST', body: '{}' });
		expect(zip.headers.get('Content-Disposition')).toContain('files.zip');

		const info = (await (await globalThis.fetch('http://api.test/server/info')).json()).data;
		expect(info.uploads).toEqual({ tus: false, maxConcurrency: 5 });
	});
});
