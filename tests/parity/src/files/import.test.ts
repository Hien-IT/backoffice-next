// Feature 007, US5 (spec FR-060, FR-061, R-14): POST /files/import from the files-fixtures server at both apps, with
// compression, redirects, names, types, the MIME filters, the IP deny list and the URLs axios refuses. Each app runs the
// same steps (scenario()); the imported rows and objects are compared like the uploads of files.test.ts.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { admin, call, fixture, idsOf, snap } from './helpers.js';
import { captureObjects, fileRows } from './storage-capture.js';

const FIXTURES = 'http://files-fixtures';
const runtime = new URL('../../.data/files-runtime/', import.meta.url);
const created: string[] = [];

beforeAll(() => {
	mkdirSync(runtime, { recursive: true });
	// R-14: a large file served at run time (no size limit on import); deterministic content.
	const big = Buffer.alloc(50 * 1024 * 1024);
	for (let i = 0; i < big.length; i += 4096) big.writeUInt32BE(i, i);
	writeFileSync(new URL('big.bin', runtime), big);
});

afterAll(async () => {
	rmSync(new URL('big.bin', runtime), { force: true });
	const ids = created.splice(0);
	if (ids.length) await appRequest('directus', 'DELETE', '/files', ids).catch(() => undefined);
	await closeHostDb();
}, 120_000);

async function importAt(ctx: Parameters<Parameters<typeof scenario>[1]>[0], body: Record<string, unknown>) {
	const res = await call(ctx, { method: 'POST', path: '/files/import', headers: await admin(), body });
	const [id] = idsOf(res);
	if (id) created.push(id);

	return {
		response: snap(res, '/files/import', id ? { file: id } : {}),
		row: id ? (await fileRows(hostDb(), [id]))[0] : undefined,
		objects: id ? (await captureObjects('local', id)).map((o) => ({ ...o, key: o.key.replace(id, '<file>') })) : [],
	};
}

describe('POST /files/import (US5)', () => {
	it.each([
		['plain image', { url: `${FIXTURES}/photo.jpg` }],
		['gzip', { url: `${FIXTURES}/gz/photo.jpg` }],
		['brotli', { url: `${FIXTURES}/br/photo.jpg` }],
		['unknown encoding stored as is', { url: `${FIXTURES}/zstd/photo.jpg` }],
		['redirects: the final URL names the file', { url: `${FIXTURES}/redirect-chain/` }],
		['a path ending in /', { url: `${FIXTURES}/dir/` }],
		['no Content-Type', { url: `${FIXTURES}/untyped` }],
		[
			'data overrides',
			{ url: `${FIXTURES}/photo-iptc.jpg`, data: { title: 'Imported', description: 'D', type: 'image/x-custom' } },
		],
		['filterMimeType match', { url: `${FIXTURES}/photo.jpg`, options: { filterMimeType: ['image/*'] } }],
		['filterMimeType mismatch', { url: `${FIXTURES}/photo.jpg`, options: { filterMimeType: ['application/pdf'] } }],
		['R-14: 50 MB without limit', { url: `${FIXTURES}/runtime/big.bin` }],
	])(
		'%s',
		async (_name, body) => {
			const transcripts = await scenario(urls(), (ctx) => importAt(ctx, body));
			assertSameTranscripts(transcripts, _name);
		},
		120_000,
	);

	it('replacing a file through data.id', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const form = new FormData();
			form.set('file', new Blob([fixture('image-8bit.png')], { type: 'image/png' }), 'old.png');
			const res = await fetch(new URL('/files', ctx.url), { method: 'POST', headers: await admin(), body: form });
			const id = ((await res.json()) as { data: { id: string } }).data.id;
			created.push(id);

			const imported = await importAt(ctx, { url: `${FIXTURES}/photo.jpg`, data: { id } });
			return {
				...imported,
				response: snap(await call(ctx, { path: `/files/${id}`, headers: await admin() }), '/files', { file: id }),
			};
		});

		assertSameTranscripts(transcripts, 'replace through import');
	});

	it.each([
		['the parity env runs no app on the host', 'http://127.0.0.1:8055/'],
		['metadata endpoint of the cloud', 'http://169.254.169.254/latest/meta-data/'],
		['IPv6 loopback', 'http://[::1]:8055/'],
		['localhost by name', 'http://localhost:8055/server/ping'],
		['ftp', 'ftp://files-fixtures/photo.jpg'],
		['file', 'file:///etc/passwd'],
		['not a URL', 'not a url'],
		['data URL (no request: 500 outside the try, FR-060)', 'data:image/png;base64,iVBORw0KGgo='],
		['a malformed escape in the final name', `${FIXTURES}/%zz.jpg`],
		['an unknown host', 'http://does-not-exist.invalid/a.jpg'],
	])(
		'refused or failing: %s',
		async (_name, url) => {
			const transcripts = await scenario(urls(), (ctx) => importAt(ctx, { url }));
			assertSameTranscripts(transcripts, _name);
			expect(transcripts.directus.row).toBeUndefined();
		},
		60_000,
	);

	it('Joi errors of the body', async () => {
		const transcripts = await scenario(urls(), async (ctx) => ({
			noUrl: (await importAt(ctx, { data: {} })).response,
			badOptions: (await importAt(ctx, { url: `${FIXTURES}/photo.jpg`, options: { filterMimeType: 'image/*' } }))
				.response,
			extra: (await importAt(ctx, { url: `${FIXTURES}/photo.jpg`, extra: 1 })).response,
		}));

		assertSameTranscripts(transcripts, 'Joi');
	});
});
