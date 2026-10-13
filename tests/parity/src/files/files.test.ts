// Feature 007, US1 and US3 (spec FR-001 to FR-017, FR-080, contracts/files-api.md): upload, JSON create, replace,
// rename, delete and read of /files at both apps, on each storage location of PARITY_STORAGES. Write flows run the
// same steps at each app (scenario()) and compare the responses, the directus_files rows, the activity and revision
// counts and the objects left on the shared storage; reads that change nothing go to both apps at once (parity()).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario, type ScenarioContext } from '../auth/scenario.js';
import { getStorages, type StorageLocation } from '../config.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createUser } from '../permissions/fixtures.js';
import { admin, call, fixture, idsOf, multipart, snap } from './helpers.js';
import { captureObjects, deleteObjects, fileRows, listObjects } from './storage-capture.js';

const run = Math.random().toString(16).slice(2, 8);
const photo = fixture('photo.jpg');
const created: string[] = [];

afterAll(async () => {
	const existing = created.splice(0);
	if (existing.length) await appRequest('directus', 'DELETE', '/files', existing).catch(() => undefined);
	await cleanup();
	await closeHostDb();
}, 120_000);

/** Activity and revision rows of directus_files for the ids, as `action` counts (spec FR-003). */
async function tracking(ids: string[]) {
	const db = hostDb();
	const activity = await db('directus_activity')
		.where({ collection: 'directus_files' })
		.whereIn('item', ids)
		.select('action')
		.orderBy('id');
	const revisions = await db('directus_revisions').where({ collection: 'directus_files' }).whereIn('item', ids).count({
		n: '*',
	});
	return { activity: activity.map((row) => row.action), revisions: Number(revisions[0]!['n']) };
}

/** Rows, tracking and storage objects of the files of one scenario run, ids as placeholders. */
async function effects(storage: StorageLocation, ids: Record<string, string>) {
	const out: Record<string, unknown> = {};

	for (const [name, id] of Object.entries(ids)) {
		const objects = await captureObjects(storage, id);
		out[name] = {
			row: (await fileRows(hostDb(), [id]))[0],
			tracking: await tracking([id]),
			objects: objects.map((o) => ({ ...o, key: o.key.replaceAll(id, `<${name}>`) })),
		};
	}

	return out;
}

async function upload(ctx: ScenarioContext, parts: Parameters<typeof multipart>[0], path = '/files', method = 'POST') {
	const { body, headers } = multipart(parts);
	return call(ctx, { method, path, body, headers: { ...(await admin()), ...headers } });
}

/**
 * The "Value is required" errors in the field order of the schema overview. On MySQL the overview query of both apps
 * (packages/schema mysql.ts, no ORDER BY) returns the columns in an order the server does not guarantee, so two
 * schema builds can list them differently (seen on CI 2026-10-13): compare them sorted by field.
 */
function byField<T>(snapshot: T): T {
	const errors = (snapshot as any).body?.errors;
	if (Array.isArray(errors))
		errors.sort((a: any, b: any) => String(a.extensions?.field).localeCompare(String(b.extensions?.field)));
	return snapshot;
}

describe.each(getStorages())('POST /files multipart on %s (US1)', (storage) => {
	it('one file with fields before it: response, row, tracking and object match', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const res = await upload(ctx, [
				{ name: 'storage', value: storage },
				{ name: 'title', value: 'Parity photo' },
				{ name: 'description', value: 'null' },
				{ name: 'file', data: photo, filename: 'photo.jpg', contentType: 'image/jpeg' },
			]);

			const [id] = idsOf(res);
			created.push(id!);

			return { response: snap(res, '/files', { file: id! }), effects: await effects(storage, { file: id! }) };
		});

		assertSameTranscripts(transcripts, 'upload one file');
		expect((transcripts.directus.effects['file'] as any).row).toMatchObject({ storage, filename_disk: '<id>.jpg' });
		// Spec FR-003: one create activity and one revision per multipart file (the sudo metadata update is untracked).
		expect((transcripts.directus.effects['file'] as any).tracking).toEqual({ activity: ['create'], revisions: 1 });
	});

	it('several files: fields apply to the next file only, the response is an array', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const res = await upload(ctx, [
				{ name: 'storage', value: storage },
				{ name: 'tags', value: '["a"]' },
				{ name: 'first', data: fixture('image-8bit.png'), filename: 'first.png', contentType: 'image/png' },
				{ name: 'storage', value: storage },
				{ name: 'second', data: fixture('document.pdf'), filename: 'second.pdf', contentType: 'application/pdf' },
				{ name: 'title', value: 'after the last file' },
			]);

			// savedFiles follows the order the uploads finish, at both apps: sort by file name before comparing.
			const rows = (res.json as { data: { id: string; filename_download: string }[] }).data;
			rows.sort((a, b) => a.filename_download.localeCompare(b.filename_download));
			const [first, second] = rows.map((row) => row.id);
			created.push(first!, second!);
			const ids = { first: first!, second: second! };

			return { response: snap(res, '/files', ids), effects: await effects(storage, ids) };
		});

		assertSameTranscripts(transcripts, 'upload two files');
	});

	it('PATCH /files/:pk multipart replaces the object; the old one and the derived assets go away (FR-012)', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const res = await upload(ctx, [
				{ name: 'storage', value: storage },
				{ name: 'file', data: photo, filename: 'photo.jpg', contentType: 'image/jpeg' },
			]);

			const [id] = idsOf(res);
			created.push(id!);

			const derived = await call(ctx, { path: `/assets/${id}?width=24`, headers: await admin() });
			const before = (await listObjects(storage, id!)).map((key) => key.replaceAll(id!, '<file>'));

			const replaced = await upload(
				ctx,
				[{ name: 'file', data: fixture('image-8bit.png'), filename: 'replacement.png', contentType: 'image/png' }],
				`/files/${id}`,
				'PATCH',
			);

			return {
				derived: derived.status,
				before,
				replaced: snap(replaced, '/files/:pk', { file: id! }),
				effects: await effects(storage, { file: id! }),
			};
		});

		assertSameTranscripts(transcripts, 'replace a file');
		expect((transcripts.directus.effects['file'] as any).objects.map((o: any) => o.key)).toEqual(['<file>.png']);
		// Spec FR-003: the replacement adds two updates (uploadOne, then updateOne(pk, {}) of the controller).
		expect((transcripts.directus.effects['file'] as any).tracking).toEqual({
			activity: ['create', 'update', 'update'],
			revisions: 3,
		});
	});
});

describe('image metadata and file edits (US3, FR-020)', () => {
	it.each([
		['photo-iptc.jpg', 'image/jpeg'],
		['photo-rotated.jpg', 'image/jpeg'],
		['photo-cmyk.jpg', 'image/jpeg'],
		['image-16bit.png', 'image/png'],
		['image-alpha.png', 'image/png'],
		['image.webp', 'image/webp'],
		['image.tiff', 'image/tiff'],
		['image.avif', 'image/avif'],
		['image-animated.gif', 'image/gif'],
		['photo-truncated.jpg', 'image/jpeg'],
		['drawing.svg', 'image/svg+xml'],
	])('%s: width, height, metadata, description, tags like Directus', async (name, type) => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const res = await upload(ctx, [{ name: 'file', data: fixture(name), filename: name, contentType: type }]);
			const [id] = idsOf(res);
			created.push(id!);
			return { response: snap(res, '/files', { file: id! }), effects: await effects('local', { file: id! }) };
		});

		assertSameTranscripts(transcripts, name);
	});

	it('PATCH title, tags, focal point, folder and filename_download as JSON', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const [folder] = idsOf(await call(ctx, { method: 'POST', path: '/folders', headers, body: { name: 'edit' } }));
			const [id] = idsOf(
				await upload(ctx, [{ name: 'file', data: photo, filename: 'edit.jpg', contentType: 'image/jpeg' }]),
			);
			created.push(id!);

			const patched = await call(ctx, {
				method: 'PATCH',
				path: `/files/${id}`,
				headers,
				body: {
					title: 'Edited',
					tags: ['x', 'y'],
					focal_point_x: 10,
					focal_point_y: 20,
					folder,
					filename_download: 'other name.jpg',
				},
			});

			const result = { patched: snap(patched, '/files/:pk', { file: id!, folder: folder! }) };
			await call(ctx, { method: 'DELETE', path: `/folders/${folder}`, headers });
			return result;
		});

		assertSameTranscripts(transcripts, 'edit a file');
	});
});

describe('POST /files JSON and errors (US1 scenario 5)', () => {
	it('JSON create with and without type or storage', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const ok = await call(ctx, {
				method: 'POST',
				path: '/files',
				headers,
				body: { type: 'image/jpeg', storage: 'local', filename_download: 'json.jpg', title: 'JSON' },
			});

			const [id] = idsOf(ok);
			created.push(id!);

			const noType = await call(ctx, { method: 'POST', path: '/files', headers, body: { storage: 'local' } });
			const noStorage = await call(ctx, { method: 'POST', path: '/files', headers, body: { type: 'image/png' } });

			return {
				ok: snap(ok, '/files', { file: id! }),
				noType: snap(noType, '/files'),
				noStorage: byField(snap(noStorage, '/files')),
				effects: await effects('local', { file: id! }),
			};
		});

		assertSameTranscripts(transcripts, 'JSON create');
	});

	it('FR-011: no extension in the name and a type without known extension gives `<id>.false`', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const res = await upload(ctx, [
				{ name: 'file', data: Buffer.from('x'), filename: 'noext', contentType: 'application/x-parity-unknown' },
			]);

			const [id] = idsOf(res);
			created.push(id!);
			return { response: snap(res, '/files', { file: id! }), effects: await effects('local', { file: id! }) };
		});

		assertSameTranscripts(transcripts, 'unknown extension');
		expect((transcripts.directus.effects['file'] as any).row.filename_disk).toBe('<id>.false');
	});

	it('multipart without a file, a part without a file name, and a non-multipart type', async () => {
		const headers = await admin();
		const noFile = multipart([{ name: 'title', value: 'x' }]);
		const noName = multipart([{ name: 'file', data: Buffer.from('x') }]);

		for (const req of [
			{ body: noFile.body, headers: { ...headers, ...noFile.headers } },
			{ body: noName.body, headers: { ...headers, ...noName.headers } },
			{ body: 'plain', headers: { ...headers, 'content-type': 'text/plain' } },
		]) {
			assertParity(await parity({ method: 'POST', path: '/files', ...req }));
		}
	});

	it('assets-limit pair: MIME allow list and FILES_MAX_UPLOAD_SIZE (413); files before the failing one stay', async () => {
		const big = Buffer.alloc(31 * 1024 * 1024, 7);

		const transcripts = await scenario(urls('assets-limit'), async (ctx) => {
			const blocked = await upload(ctx, [
				{ name: 'file', data: Buffer.from('text'), filename: 'a.txt', contentType: 'text/plain' },
			]);

			const tooLarge = await upload(ctx, [{ name: 'file', data: big, filename: 'big.png', contentType: 'image/png' }]);

			const partly = await upload(ctx, [
				{ name: 'title', value: `partly-${run}-${ctx.app}` },
				{ name: 'first', data: photo, filename: 'first.jpg', contentType: 'image/jpeg' },
				{ name: 'second', data: big, filename: 'second.png', contentType: 'image/png' },
			]);

			const kept = await hostDb()('directus_files')
				.where({ title: `partly-${run}-${ctx.app}` })
				.select('id');
			created.push(...kept.map((row) => row.id));

			return {
				blocked: snap(blocked, '/files'),
				tooLarge: snap(tooLarge, '/files'),
				partly: snap(partly, '/files'),
				kept: kept.length,
			};
		});

		assertSameTranscripts(transcripts, 'upload limits');
		expect(transcripts.directus.kept).toBe(1);
	}, 120_000);
});

describe('delete and rename (FR-014, FR-016, R-13)', () => {
	it('DELETE one, an array, keys and a query: rows and objects go away', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const ids: string[] = [];

			for (let i = 0; i < 4; i++) {
				const res = await upload(ctx, [
					{ name: 'title', value: `delete-${run}-${ctx.app}-${i}` },
					{ name: 'file', data: photo, filename: `d${i}.jpg`, contentType: 'image/jpeg' },
				]);

				ids.push(idsOf(res)[0]!);
			}

			const headers = await admin();
			const one = await call(ctx, { method: 'DELETE', path: `/files/${ids[0]}`, headers });
			const array = await call(ctx, { method: 'DELETE', path: '/files', headers, body: [ids[1]] });
			const keys = await call(ctx, { method: 'DELETE', path: '/files', headers, body: { keys: [ids[2]] } });

			const query = await call(ctx, {
				method: 'DELETE',
				path: '/files',
				headers,
				body: { query: { filter: { title: { _eq: `delete-${run}-${ctx.app}-3` } } } },
			});

			const left = await Promise.all(ids.map(async (id) => (await listObjects('local', id)).length));
			const rows = await hostDb()('directus_files').whereIn('id', ids).count({ n: '*' });
			const assets = await call(ctx, { path: `/assets/${ids[0]}`, headers });

			return {
				statuses: [one.status, array.status, keys.status, query.status],
				left,
				rows: Number(rows[0]!['n']),
				tracking: (await tracking(ids)).activity,
				assetAfterDelete: snap(assets, '/assets/:pk'),
			};
		});

		assertSameTranscripts(transcripts, 'delete files');
		expect(transcripts.directus.statuses).toEqual([204, 204, 204, 204]);
	});

	it('R-13: deleting a file with a short filename_disk also deletes other objects with that prefix', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const prefix = `r13${run}${ctx.app.slice(0, 1)}`;
			const headers = await admin();
			const ids: string[] = [];

			for (const [name, disk] of [
				['short', `${prefix}.jpg`],
				['longer', `${prefix}graphy.jpg`],
			] as const) {
				const res = await upload(ctx, [
					{ name: 'file', data: photo, filename: `${name}.jpg`, contentType: 'image/jpeg' },
				]);

				const id = idsOf(res)[0]!;
				ids.push(id);
				await call(ctx, { method: 'PATCH', path: `/files/${id}`, headers, body: { filename_disk: disk } });
			}

			created.push(ids[1]!);
			const before = await listObjects('local', prefix);
			const deleted = await call(ctx, { method: 'DELETE', path: `/files/${ids[0]}`, headers });
			const after = await listObjects('local', prefix);
			const replace = (keys: string[]) => keys.map((key) => key.replace(prefix, '<prefix>'));

			return { before: replace(before), deleted: deleted.status, after: replace(after) };
		});

		assertSameTranscripts(transcripts, 'R-13 prefix delete');
		// Directus deletes `<prefix>graphy.jpg` too: the object of another file (rapporteur evidence for R-13).
		expect(transcripts.directus).toEqual({
			before: ['<prefix>.jpg', '<prefix>graphy.jpg'],
			deleted: 204,
			after: [],
		});
	});

	it('PATCH filename_disk: move to a free name, repoint to an existing object; several files at once is 400', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const name = `move${run}${ctx.app.slice(0, 1)}`;

			const a = idsOf(
				await upload(ctx, [{ name: 'file', data: photo, filename: 'a.jpg', contentType: 'image/jpeg' }]),
			)[0]!;
			const b = idsOf(
				await upload(ctx, [{ name: 'file', data: photo, filename: 'b.jpg', contentType: 'image/jpeg' }]),
			)[0]!;
			created.push(a, b);

			const moved = await call(ctx, {
				method: 'PATCH',
				path: `/files/${a}`,
				headers,
				body: { filename_disk: `${name}.jpg` },
			});

			const existing = await call(ctx, {
				method: 'PATCH',
				path: `/files/${b}`,
				headers,
				body: { filename_disk: `${name}.jpg` },
			});

			const many = await call(ctx, {
				method: 'PATCH',
				path: '/files',
				headers,
				body: { keys: [a, b], data: { filename_disk: `${name}-x.jpg` } },
			});

			const objects = {
				name: (await listObjects('local', name)).map((key) => key.replace(name, '<name>')),
				a: (await listObjects('local', a)).length,
				b: (await listObjects('local', b)).length,
			};

			await deleteObjects('local', await listObjects('local', name));

			return {
				moved: snap(moved, '/files/:pk', { a, b, name }),
				existing: snap(existing, '/files/:pk', { a, b, name }),
				many: snap(many, '/files'),
				objects,
			};
		});

		assertSameTranscripts(transcripts, 'rename filename_disk');
	});
});

describe('read and permissions (US1 scenario 7, US3 scenario 1)', () => {
	let fileId: string;
	let reader: string;

	beforeAll(async () => {
		const { body, headers } = multipart([
			{ name: 'title', value: `read-${run}` },
			{ name: 'file', data: photo, filename: 'read.jpg', contentType: 'image/jpeg' },
		]);

		const res = await fetch(new URL('/files', urls().directus), {
			method: 'POST',
			headers: { ...(await admin()), ...headers },
			body,
		});

		fileId = ((await res.json()) as { data: { id: string } }).data.id;
		created.push(fileId);

		const policy = await createPolicy('directus', `files-read-${run}`, {
			permissions: [
				{
					collection: 'directus_files',
					action: 'read',
					fields: ['id', 'title', 'type'],
					permissions: { title: { _eq: `read-${run}` } },
				} as any,
			],
		});

		const user = await createUser('directus', `files-reader-${run}`);
		await attachPolicy('directus', policy, { user: user.id });
		reader = user.token;
	});

	it('GET /files with filter, search, sort, fields and meta; SEARCH with keys', async () => {
		const headers = await admin();
		const filter = encodeURIComponent(JSON.stringify({ title: { _eq: `read-${run}` } }));

		assertParity(await parity({ path: `/files?filter=${filter}&sort=-title&fields=*&meta=*`, headers }));
		assertParity(await parity({ path: `/files?search=read-${run}&fields=id,title,filesize`, headers }));
		assertParity(await parity({ method: 'SEARCH', path: '/files', headers, body: { keys: [fileId] } }));
		assertParity(await parity({ path: `/files/${fileId}`, headers }));
		assertParity(await parity({ method: 'HEAD', path: `/files/${fileId}`, headers }));
	});

	it('a user with partial read access sees only the allowed fields; other files are 403', async () => {
		const headers = { authorization: `Bearer ${reader}` };

		assertParity(await parity({ path: `/files/${fileId}`, headers }));
		assertParity(await parity({ path: `/files?fields=*`, headers }));
		assertParity(await parity({ path: `/assets/${fileId}`, headers }));
		assertParity(await parity({ path: '/files/00000000-0000-4000-8000-000000000000', headers }));
		assertParity(await parity({ method: 'POST', path: '/files', headers, body: { type: 'x', storage: 'local' } }));
	});

	it('OPTIONS of every files route', async () => {
		for (const path of ['/files', '/files/import', `/files/${fileId}`, '/files/tus', '/files/tus/abc']) {
			assertParity(await parity({ method: 'OPTIONS', path }));
		}
	});
});
