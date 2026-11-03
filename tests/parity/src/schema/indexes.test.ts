// Spec 030 (contracts/tests.md, research R11): composite B-tree indexes (every vendor) and trigram indexes (Postgres)
// of a user collection through /backoffice/collections/:collection/indexes. Directus 11.17.4 has no such route (D-210);
// /fields stays equal at both apps (D-210.1); a composite unique violation answers one error per field at Backoffice
// (D-210.4); deleting a field at Backoffice drops the index first, Directus leaves a missing row (D-210.3).
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { knexConfig } from '../config.js';
import { adminToken, appRequest, appUrl, type AppName } from '../directus-api.js';
import { multipart } from '../files/helpers.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { gqlRequest } from '../graphql/helpers.js';
import { assertParity, capture, parity, type Captured, type ParityRequest } from '../parity.js';
import { createUserCollection } from '../permissions/fixtures.js';

vi.setConfig({ testTimeout: 240_000 });

const [vendor] = getDbsToTest();
const PG = vendor === 'postgres' || vendor === 'postgres10';
const SQLITE = vendor === 'sqlite3';
const MYSQL = vendor === 'mysql' || vendor === 'mysql5' || vendor === 'maria';

const run = Math.random().toString(16).slice(2, 10);
const C = `parity_idx_${run}`;
const BASE = `/backoffice/collections/${C}/indexes`;
const UNIQUE = `${C}_provider_provider_subject_unique`;

let db: Knex;
let admin: string;
const auth = () => ({ authorization: `Bearer ${admin}` });

const at = (app: AppName, req: ParityRequest): Promise<Captured> =>
	capture(appUrl(app), { ...req, headers: { 'cache-control': 'no-store', ...auth(), ...req.headers } });

const bo = (method: string, path: string, body?: unknown) => appRequest('backoffice', method, path, body);

interface Row {
	id: string;
	name: string;
	fields: string[];
	type: string;
	unique: boolean;
	status: string;
	error: string | null;
	missing: boolean | null;
}

const list = async (): Promise<{ data: Row[]; meta: { trigram: boolean; concurrent: boolean } }> => bo('GET', BASE);

/** Polls until the row is no longer `creating`. */
async function settled(name: string, timeoutMs = 120_000): Promise<Row> {
	const started = Date.now();

	for (;;) {
		const row = (await list()).data.find((r) => r.name === name);
		if (row && row.status !== 'creating') return row;
		if (Date.now() - started > timeoutMs) throw new Error(`${name} still ${row?.status ?? 'absent'} after ${timeoutMs} ms`);
		await new Promise((r) => setTimeout(r, 500));
	}
}

/** The database itself (read only on SQLite: the file belongs to the containers on Linux CI). */
async function indexColumns(name: string): Promise<string[] | undefined> {
	if (PG) {
		const r = await db.raw(
			`SELECT string_agg(a.attname, ',' ORDER BY k.ord) AS columns FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord) ON true LEFT JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k.attnum WHERE i.relname = ? GROUP BY i.relname`,
			[name],
		);
		return r.rows[0] ? String(r.rows[0].columns ?? '').split(',').filter(Boolean) : undefined;
	}

	if (MYSQL) {
		const [rows] = await db.raw(
			`SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns FROM information_schema.statistics WHERE table_schema = database() AND index_name = ? GROUP BY index_name`,
			[name],
		);
		return rows[0] ? String(rows[0].columns).split(',') : undefined;
	}

	const rows: { name: string }[] = await db.raw(`PRAGMA index_list(??)`, [C]);
	if (!rows.some((r) => r.name === name)) return undefined;
	const info: { seqno: number; name: string }[] = await db.raw(`PRAGMA index_info(??)`, [name]);
	return info.sort((a, b) => a.seqno - b.seqno).map((c) => c.name);
}

// Outside the seeded pairs (p0..p6 × s0..s9999).
const dup = { provider: 'zz', provider_subject: 'zz', name: 'dup', note: 'n' };

beforeAll(async () => {
	db = knex(knexConfig[vendor!]);
	admin = await adminToken('directus');

	await createUserCollection(C, [
		{ field: 'provider', type: 'string', meta: {} },
		{ field: 'provider_subject', type: 'string', meta: {} },
		{ field: 'name', type: 'string', meta: {} },
		{ field: 'note', type: 'text', meta: {} },
		{ field: 'payload', type: 'json', meta: { special: ['cast-json'] } },
		{ field: 'divider', type: 'alias', meta: { special: ['alias', 'no-data'], interface: 'presentation-divider' } },
	]);

	// 10,000 rows so the Postgres planner picks the trigram index (research R2).
	if (PG) {
		const rows = Array.from({ length: 10_000 }, (_, i) => ({
			provider: `p${i % 7}`,
			provider_subject: `s${i}`,
			name: `name-${(i * 7919).toString(36)}`,
			note: null,
		}));
		await db.batchInsert(C, rows, 1000);
	}
}, 180_000);

afterAll(async () => {
	await appRequest('backoffice', 'DELETE', `/collections/${C}`).catch(() => undefined);
	await db.destroy();
});

describe('D-210: the routes exist at Backoffice only', () => {
	it('Directus answers 404 on GET, POST and DELETE', async () => {
		expect((await at('directus', { path: BASE })).status).toBe(404);
		expect((await at('directus', { method: 'POST', path: BASE, body: { fields: ['provider'] } })).status).toBe(404);
		expect((await at('directus', { method: 'DELETE', path: `${BASE}/x` })).status).toBe(404);
	});

	it('403 for a system collection and for a user who is not admin at Backoffice', async () => {
		expect((await at('backoffice', { path: '/backoffice/collections/directus_users/indexes' })).status).toBe(403);
		const anon = await capture(appUrl('backoffice'), { path: BASE, headers: { 'cache-control': 'no-store' } });
		expect(anon.status).toBe(401);
	});
});

describe('US1: a composite unique index', () => {
	it('POST 202 creating → ready; the index is on the database; /fields stays equal (D-210.1)', async () => {
		const created = await at('backoffice', {
			method: 'POST',
			path: BASE,
			body: { fields: ['provider', 'provider_subject'], unique: true },
		});
		expect(created.status, created.text).toBe(202);
		expect((created.json as any).data).toMatchObject({
			name: UNIQUE,
			fields: ['provider', 'provider_subject'],
			type: 'btree',
			unique: true,
			status: 'creating',
			missing: null,
		});

		const row = await settled(UNIQUE);
		expect(row).toMatchObject({ status: 'ready', error: null, missing: false });
		expect(await indexColumns(UNIQUE)).toEqual(['provider', 'provider_subject']);

		assertParity(await parity({ path: `/fields/${C}`, headers: auth() }));
		assertParity(await parity({ path: `/fields/${C}/provider`, headers: auth() }));

		const { meta } = await list();
		expect(meta).toEqual({ trigram: PG, concurrent: !SQLITE });

		const activity = await bo(
			'GET',
			`/activity?filter[collection][_eq]=backoffice_indexes&filter[item][_eq]=${row.id}&sort=id&fields=action,user`,
		);
		expect(activity.data.map((a: any) => a.action)).toEqual(['create', 'update']);
	});

	it('a duplicate pair is refused at both apps; Backoffice names each field (D-210.4)', async () => {
		await bo('POST', `/items/${C}`, dup);

		const result = await parity({ method: 'POST', path: `/items/${C}`, headers: auth(), body: dup });
		assertParity(result);
		expect(result.directus.status).toBe(400);
		expect(result.backoffice.status).toBe(400);
		const errors = (result.backoffice.json as any).errors;
		expect(errors.map((e: any) => e.extensions)).toEqual([
			{ code: 'RECORD_NOT_UNIQUE', collection: C, field: 'provider', value: 'zz' },
			{ code: 'RECORD_NOT_UNIQUE', collection: C, field: 'provider_subject', value: 'zz' },
		]);
		expect((result.directus.json as any).errors).toHaveLength(1);

		const gql = await at(
			'backoffice',
			gqlRequest(
				'items',
				`mutation { create_${C}_item(data: { provider: "zz", provider_subject: "zz" }) { id } }`,
			) as unknown as ParityRequest,
		);
		// GraphQL keeps the first error of an array, as DR's formatError does for every error array (D-210.4).
		expect((gql.json as any).errors.map((e: any) => e.extensions.field)).toEqual(['provider']);

		const { body, headers } = multipart([
			{
				name: 'file',
				data: Buffer.from('provider,provider_subject\nzz,zz\n'),
				filename: 'rows.csv',
				contentType: 'text/csv',
			},
		]);
		const imported = await at('backoffice', { method: 'POST', path: `/utils/import/${C}`, headers, body });
		expect(imported.status, imported.text).toBe(400);
		expect((imported.json as any).errors.map((e: any) => e.extensions.field)).toEqual(['provider', 'provider_subject']);
	});

	it('validation: 400 for empty, alias, unknown, json, nine fields, a duplicate definition; text per vendor', async () => {
		const post = (body: Record<string, unknown>) => at('backoffice', { method: 'POST', path: BASE, body });
		for (const body of [
			{ fields: [] },
			{ fields: ['divider'] },
			{ fields: ['nope'] },
			{ fields: ['payload'] },
			{ fields: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] },
			{ fields: ['provider', 'provider_subject'], unique: true },
			{ fields: ['name'], type: 'hash' },
		]) {
			const res = await post(body);
			expect(res.status, `${JSON.stringify(body)}: ${res.text}`).toBe(400);
			expect((res.json as any).errors[0].extensions.code).toBe('INVALID_PAYLOAD');
		}

		const text = await post({ fields: ['note'] });

		if (MYSQL) {
			expect(text.status, text.text).toBe(400);
			expect((text.json as any).errors[0].message).toMatch(/MySQL/);
		} else {
			expect(text.status, text.text).toBe(202);
			expect((await settled(`${C}_note_index`)).status).toBe('ready');
		}
	});

	it('concurrentIndexCreation=false builds the plain way and is ready', async () => {
		const res = await at('backoffice', {
			method: 'POST',
			path: `${BASE}?concurrentIndexCreation=false`,
			body: { fields: ['provider'] },
		});
		expect(res.status, res.text).toBe(202);
		expect((await settled(`${C}_provider_index`)).status).toBe('ready');
	});
});

describe('US2: trigram', () => {
	it(PG ? 'builds a GIN index on lower(name) that ?search= uses' : 'is refused outside PostgreSQL', async () => {
		const res = await at('backoffice', { method: 'POST', path: BASE, body: { fields: ['name'], type: 'trigram' } });

		if (!PG) {
			expect(res.status, res.text).toBe(400);
			expect((res.json as any).errors[0].message).toMatch(/PostgreSQL/);
			return;
		}

		expect(res.status, res.text).toBe(202);
		expect((await settled(`${C}_name_trgm`)).status).toBe('ready');
		expect((await db.raw(`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`)).rows).toHaveLength(1);

		const plan = (await db.raw(`EXPLAIN (COSTS OFF) SELECT * FROM ?? WHERE LOWER(??) LIKE ?`, [C, 'name', '%abc%'])).rows
			.map((r: any) => r['QUERY PLAN'])
			.join('\n');
		expect(plan).toContain(`Bitmap Index Scan on ${C}_name_trgm`);

		assertParity(await parity({ path: `/items/${C}?search=name-1&limit=25&sort=id`, headers: auth() }));
	});

	it('refuses two fields, a non-text field and unique', async () => {
		for (const body of [
			{ fields: ['name', 'note'], type: 'trigram' },
			{ fields: ['payload'], type: 'trigram' },
			{ fields: ['name'], type: 'trigram', unique: true },
		]) {
			const res = await at('backoffice', { method: 'POST', path: BASE, body });
			expect(res.status, `${JSON.stringify(body)}: ${res.text}`).toBe(400);
		}
	});
});

describe('US4: delete, cascade, missing (D-210.3)', () => {
	it('DELETE drops the index and the row; the duplicate pair is accepted again', async () => {
		expect((await at('backoffice', { method: 'DELETE', path: `${BASE}/${UNIQUE}` })).status).toBe(204);
		expect(await indexColumns(UNIQUE)).toBeUndefined();
		expect((await list()).data.find((r) => r.name === UNIQUE)).toBeUndefined();

		const again = await at('backoffice', { method: 'POST', path: `/items/${C}`, body: dup });
		expect(again.status, again.text).toBe(200);
		expect((await at('backoffice', { method: 'DELETE', path: `${BASE}/${UNIQUE}` })).status).toBe(403);
	});

	it('deleting a field at Backoffice drops the indexes with it first; /fields equal afterwards', async () => {
		const res = await at('backoffice', {
			method: 'POST',
			path: BASE,
			body: { fields: ['provider', 'provider_subject'] },
		});
		expect(res.status, res.text).toBe(202);
		const name = `${C}_provider_provider_subject_index`;
		expect((await settled(name)).status).toBe('ready');

		await bo('DELETE', `/fields/${C}/provider_subject`);

		expect(await indexColumns(name)).toBeUndefined();
		expect((await list()).data.map((r) => r.name)).not.toContain(name);
		assertParity(await parity({ path: `/fields/${C}`, headers: auth() }));

		await bo('POST', `/fields/${C}`, { field: 'provider_subject', type: 'string', meta: {} });
	});

	it('Directus deleting a column leaves a missing row that DELETE removes', async () => {
		const res = await at('backoffice', {
			method: 'POST',
			path: BASE,
			body: { fields: ['provider', 'provider_subject'] },
		});
		expect(res.status, res.text).toBe(202);
		const name = `${C}_provider_provider_subject_index`;
		expect((await settled(name)).status).toBe('ready');

		await appRequest('directus', 'DELETE', `/fields/${C}/provider_subject`);

		const row = (await list()).data.find((r) => r.name === name);
		expect(row).toMatchObject({ status: 'ready', missing: true });
		expect((await at('backoffice', { method: 'DELETE', path: `${BASE}/${name}` })).status).toBe(204);
		expect(await indexColumns(name)).toBeUndefined();

		await appRequest('directus', 'POST', `/fields/${C}`, { field: 'provider_subject', type: 'string', meta: {} });
	});

	it('schema/apply removing a field goes through the same cascade', async () => {
		const res = await at('backoffice', { method: 'POST', path: BASE, body: { fields: ['note'] } });
		expect(res.status === 202 || res.status === 400, res.text).toBe(true); // MySQL: text refused (FR-001a)
		if (res.status === 202) expect((await settled(`${C}_note_index`)).status).toBe('ready');

		const snapshot = (await bo('GET', '/schema/snapshot')).data;
		snapshot.fields = snapshot.fields.filter((f: any) => !(f.collection === C && f.field === 'note'));
		const diff = (await bo('POST', '/schema/diff?force=true', snapshot)).data;
		await bo('POST', '/schema/apply', diff);

		expect((await list()).data.map((r) => r.name)).not.toContain(`${C}_note_index`);
		assertParity(await parity({ path: `/fields/${C}`, headers: auth() }));
	});

	it('a row still being created refuses DELETE and the delete of its field', async () => {
		if (SQLITE) return; // the database file of the containers is read only from the host on Linux CI

		const name = `${C}_zz_index`;
		await db('backoffice_indexes').insert({
			id: '3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f99',
			collection: C,
			name,
			fields: JSON.stringify(['provider']),
			type: 'btree',
			unique: false,
			status: 'creating',
		});

		try {
			const del = await at('backoffice', { method: 'DELETE', path: `${BASE}/${name}` });
			expect(del.status, del.text).toBe(400);
			const field = await at('backoffice', { method: 'DELETE', path: `/fields/${C}/provider` });
			expect(field.status, field.text).toBe(400);
		} finally {
			await db('backoffice_indexes').where({ name }).delete();
		}
	});

	it('deleting the collection at Backoffice removes the rows', async () => {
		const res = await at('backoffice', { method: 'POST', path: BASE, body: { fields: ['provider', 'name'] } });
		expect(res.status, res.text).toBe(202);
		await settled(`${C}_provider_name_index`);

		await bo('DELETE', `/collections/${C}`);

		expect(await db('backoffice_indexes').where({ collection: C })).toEqual([]);
	});
});
