// Feature 007, US3 (spec FR-021, contracts/files-api.md §2): /folders CRUD at both apps, the foreign keys of the
// system schema when a folder goes away (files to the root, storage_default_folder to null, children block), OPTIONS.
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { setSettings, urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { assertParity, type Captured, parity } from '../parity.js';
import { admin, call, fixture, idsOf, multipart, snap } from './helpers.js';
import { folderRows } from './storage-capture.js';

const run = Math.random().toString(16).slice(2, 8);
const files: string[] = [];
const folders: string[] = [];

afterAll(async () => {
	if (files.length) await appRequest('directus', 'DELETE', '/files', files.splice(0)).catch(() => undefined);
	// Children first: the parent foreign key has no ON DELETE.
	for (const id of folders.splice(0).reverse())
		await appRequest('directus', 'DELETE', `/folders/${id}`).catch(() => undefined);
	await closeHostDb();
}, 120_000);

/** `data` of a response in the order of `ids` (rows come back in primary key order: random uuids on MySQL and SQLite). */
const inOrder = (c: Captured, ids: (string | undefined)[]): Captured => {
	const data = (c.json as { data?: { id: string }[] } | undefined)?.data;
	if (!Array.isArray(data)) return c;
	return {
		...c,
		json: { ...(c.json as object), data: [...data].sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id)) },
	};
};

describe('/folders (US3)', () => {
	it('create one and many, read, search, update, delete with their rows', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const name = `parity-${run}-${ctx.app}`;

			const root = await call(ctx, { method: 'POST', path: '/folders', headers, body: { name } });
			const [rootId] = idsOf(root);

			const children = await call(ctx, {
				method: 'POST',
				path: '/folders',
				headers,
				body: [
					{ name: 'a', parent: rootId },
					{ name: 'b', parent: rootId },
				],
			});

			// Rows come back in primary key order (random uuids on MySQL and SQLite): name the ids by `name`.
			const created = ((children.json as any)?.data ?? []) as { id: string; name: string }[];
			const [a, b] = ['a', 'b'].map((n) => created.find((f) => f.name === n)?.id);
			folders.push(rootId!, a!, b!);
			const ids = { root: rootId!, a: a!, b: b!, name };

			const filter = encodeURIComponent(JSON.stringify({ parent: { _eq: rootId } }));
			const list = await call(ctx, { path: `/folders?filter=${filter}&sort=name&meta=filter_count`, headers });
			const search = await call(ctx, { method: 'SEARCH', path: '/folders', headers, body: { keys: [a, b] } });
			const one = await call(ctx, { path: `/folders/${a}`, headers });
			const renamed = await call(ctx, { method: 'PATCH', path: `/folders/${a}`, headers, body: { name: 'a2' } });
			const batch = await call(ctx, {
				method: 'PATCH',
				path: '/folders',
				headers,
				body: { keys: [a, b], data: { name: 'c' } },
			});

			const rows = await folderRows(hostDb(), [rootId!, a!, b!]);
			const removed = await call(ctx, { method: 'DELETE', path: `/folders/${b}`, headers });

			return {
				root: snap(root, '/folders', ids),
				children: snap(inOrder(children, [a, b]), '/folders', ids),
				list: snap(list, '/folders', ids),
				search: snap(inOrder(search, [a, b]), '/folders', ids),
				one: snap(one, '/folders/:pk', ids),
				renamed: snap(renamed, '/folders/:pk', ids),
				batch: snap(inOrder(batch, [a, b]), '/folders', ids),
				rows: JSON.parse(JSON.stringify(rows).replaceAll(rootId!, '<root>').replaceAll(name, '<name>')),
				removed: removed.status,
			};
		});

		assertSameTranscripts(transcripts, 'folders CRUD');
	});

	it('deleting a folder moves its files to the root and clears storage_default_folder; a parent with children fails', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const [parent] = idsOf(await call(ctx, { method: 'POST', path: '/folders', headers, body: { name: 'p' } }));
			const [child] = idsOf(
				await call(ctx, { method: 'POST', path: '/folders', headers, body: { name: 'c', parent } }),
			);
			const [holder] = idsOf(await call(ctx, { method: 'POST', path: '/folders', headers, body: { name: 'h' } }));
			folders.push(parent!, child!, holder!);

			const { body, headers: form } = multipart([
				{ name: 'folder', value: holder! },
				{ name: 'file', data: fixture('photo.jpg'), filename: 'in-folder.jpg', contentType: 'image/jpeg' },
			]);

			const [file] = idsOf(await call(ctx, { method: 'POST', path: '/files', body, headers: { ...headers, ...form } }));
			files.push(file!);

			const restore = await setSettings({ storage_default_folder: holder });
			const deleted = await call(ctx, { method: 'DELETE', path: `/folders/${holder}`, headers });
			const defaultFolder = (await hostDb()('directus_settings').first('storage_default_folder'))
				?.storage_default_folder;
			await restore().catch(() => undefined);

			const fileFolder = (await hostDb()('directus_files').where({ id: file }).first('folder'))?.folder;
			const withChildren = await call(ctx, { method: 'DELETE', path: `/folders/${parent}`, headers });
			const parentLeft = await hostDb()('directus_folders').where({ id: parent }).count({ n: '*' });

			return {
				deleted: deleted.status,
				defaultFolder,
				fileFolder,
				// Spec FR-021: the error of the parent foreign key is not translated (500 on Postgres, measured here).
				withChildren: { status: withChildren.status, code: (withChildren.json as any)?.errors?.[0]?.extensions?.code },
				parentLeft: Number(parentLeft[0]!['n']),
			};
		});

		assertSameTranscripts(transcripts, 'delete folders');
		expect(transcripts.directus).toMatchObject({
			deleted: 204,
			defaultFolder: null,
			fileFolder: null,
			withChildren: { status: 500, code: 'INTERNAL_SERVER_ERROR' },
			parentLeft: 1,
		});
	});

	it('OPTIONS, unknown folder, errors of validateBatch', async () => {
		const headers = await admin();

		for (const path of ['/folders', '/folders/x']) assertParity(await parity({ method: 'OPTIONS', path }));
		assertParity(await parity({ path: '/folders/00000000-0000-4000-8000-000000000000', headers }));
		assertParity(await parity({ method: 'PATCH', path: '/folders', headers, body: { data: { name: 'x' } } }));
		assertParity(await parity({ path: '/folders', headers: {} }));
	});
});
