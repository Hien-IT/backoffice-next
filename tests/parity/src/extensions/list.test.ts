// Spec 020 US5 (FR-031, FR-032, T025): GET /extensions at both apps with the fixture extensions loaded from the shared
// S3 location: the loaded schema, the bundle entries under their parent, a row whose folder is gone (schema null); the
// app bundle (D-137) and an unknown chunk.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { admin, FIXTURES, extRows, same } from './helpers.js';

const missing = randomUUID();

beforeAll(async () => {
	await hostDb()('directus_extensions').insert({
		id: missing,
		enabled: true,
		folder: 'parity-list-missing',
		source: 'local',
		bundle: null,
	});
});

afterAll(async () => {
	await hostDb()('directus_extensions').where({ id: missing }).delete();
	await closeHostDb();
});

describe('GET /extensions', () => {
	it('the same list at both apps: every fixture with its schema, the entries of the bundle, the missing row', async () => {
		const result = await same({ path: '/extensions', headers: await admin() });
		const data = (result.backoffice.json as { data: any[] }).data;

		for (const name of FIXTURES) {
			const row = data.find((ext) => ext.meta.folder === name && ext.bundle === null);
			expect(row?.schema, name).not.toBeNull();
		}

		const bundle = data.find((ext) => ext.meta.folder === 'parity-bundle-tools')!;
		const entries = data.filter((ext) => ext.bundle === bundle.id).map((ext) => ext.schema.name);
		expect(entries.sort()).toEqual(['bundle-hook', 'bundle-iface', 'bundle-op']);

		expect(data.find((ext) => ext.id === missing)?.schema).toBeNull();
	});

	it('the rows of directus_extensions: one per extension and bundle entry, no duplicate (R-58)', async () => {
		const rows = await extRows();
		const keys = rows.map((row) => `${row.source}:${row.bundle ?? ''}:${row.folder}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('as a user without admin access, public; OPTIONS', async () => {
		await same({ path: '/extensions' });
		await same({ method: 'OPTIONS', path: '/extensions' });
	});
});

describe('GET /extensions/sources/:chunk', () => {
	it('index.js: status and headers of Directus (body D-137); an unknown chunk is the same 404', async () => {
		const result = await same({ path: '/extensions/sources/index.js' });
		expect(result.backoffice.status).toBe(200);
		// Wave 1: the new app still serves the empty bundle (T142 builds it in wave 2).
		expect(result.directus.text).toContain('parity-interface-color');

		await same({ path: '/extensions/sources/nope.js' });
		await same({ path: '/extensions/sources/..%2Fpackage.json' });
	});
});
