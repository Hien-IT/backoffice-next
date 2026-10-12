// Feature 006, US4 (FR-040 to FR-043, contracts/snapshot.md): /schema/snapshot, /schema/diff and /schema/apply. Reads
// go to both apps at once and must be equal byte for byte; apply runs in sequence on the shared database from the same
// starting model (ddlScenario with setup): same responses, same DDL and metadata. Snapshots taken at one app are
// diffed and applied at the other.
import { load as loadYaml } from 'js-yaml';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knexConfig } from '../config.js';
import { type AppName, adminToken, appRequest, directusRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { assertParity, capture, parity, type ParityRequest } from '../parity.js';
import { cleanup, createUser } from '../permissions/fixtures.js';
import { cleanupTables, ddlScenario } from './ddl-scenario.js';

const [vendor] = getDbsToTest();
const P = 'parity_sm_schema';
const A = `${P}_a`;
const B = `${P}_b`;
const NEW = `${P}_new`;
// Deleted last first (cleanupTables): A before B, which A's foreign key points at.
const TABLES = [B, A, NEW];

let db: Knex;
let admin: string;

const pk = {
	field: 'id',
	type: 'integer',
	meta: { hidden: true },
	schema: { is_primary_key: true, has_auto_increment: true },
};

/** The starting model: B, A with a string and an m2o to B with its o2m alias. */
async function startingModel(app: AppName = 'directus') {
	await appRequest(app, 'POST', '/collections', { collection: B, schema: {}, meta: { icon: 'box' }, fields: [pk] });
	await appRequest(app, 'POST', '/collections', {
		collection: A,
		schema: {},
		meta: { note: 'start' },
		fields: [
			pk,
			{ field: 'title', type: 'string', meta: { interface: 'input' }, schema: { max_length: 100 } },
			{ field: 'b', type: 'integer', meta: { special: ['m2o'] } },
			{ field: 'old', type: 'text', meta: {} },
		],
	});
	await appRequest(app, 'POST', `/fields/${B}`, { field: 'as', type: 'alias', meta: { special: ['o2m'] } });
	await appRequest(app, 'POST', '/relations', {
		collection: A,
		field: 'b',
		related_collection: B,
		meta: { one_field: 'as' },
		schema: { on_delete: 'SET NULL' },
	});
}

/** The target model: edits, a new field, a deleted field, a new collection, another on_delete, an index on a system field. */
async function changeModel(app: AppName = 'directus') {
	await appRequest(app, 'PATCH', `/collections/${A}`, { meta: { note: 'target' } });
	await appRequest(app, 'PATCH', `/fields/${A}/title`, { schema: { max_length: 200, is_indexed: true } });
	await appRequest(app, 'POST', `/fields/${A}`, {
		field: 'rating',
		type: 'integer',
		meta: {},
		schema: { default_value: 1 },
	});
	await appRequest(app, 'DELETE', `/fields/${A}/old`);
	await appRequest(app, 'PATCH', `/relations/${A}/b`, {
		collection: A,
		field: 'b',
		related_collection: B,
		schema: { on_delete: 'CASCADE' },
	});
	await appRequest(app, 'POST', '/collections', {
		collection: NEW,
		schema: {},
		meta: { group: null },
		fields: [pk, { field: 'code', type: 'uuid', meta: {} }],
	});
	await appRequest(app, 'PATCH', '/fields/directus_users/title', { schema: { is_indexed: true } });
}

async function resetSystemIndex(app: AppName = 'directus') {
	await appRequest(app, 'PATCH', '/fields/directus_users/title', { schema: { is_indexed: false } }).catch(
		() => undefined,
	);
}

const fresh = { 'cache-control': 'no-store' };
const asAdmin = (req: ParityRequest): ParityRequest => ({
	...req,
	headers: { authorization: `Bearer ${admin}`, ...fresh, ...req.headers },
});

beforeAll(async () => {
	db = knex(knexConfig[vendor!]);
	admin = await adminToken('directus');
	await cleanupTables('directus', TABLES);
	await resetSystemIndex();
}, 120_000);

afterAll(async () => {
	await cleanupTables('directus', TABLES);
	await resetSystemIndex();
	await cleanup();
	await db.destroy();
}, 120_000);

describe('snapshot (FR-040)', () => {
	beforeAll(async () => {
		await startingModel();
	}, 120_000);

	afterAll(async () => {
		await cleanupTables('directus', TABLES);
	});

	it('JSON: byte for byte the same at both apps (Cache-Control: no-store, the route is cached)', async () => {
		const [d, b] = await Promise.all([
			capture(process.env['DIRECTUS_URL']!, asAdmin({ path: '/schema/snapshot' })),
			capture(process.env['BACKOFFICE_URL']!, asAdmin({ path: '/schema/snapshot' })),
		]);

		expect(d.status).toBe(200);
		expect(b.text).toBe(d.text);
		expect((d.json as any).data).toMatchObject({ version: 1, directus: '11.17.4' });
		assertParity(await parity(asAdmin({ path: '/schema/snapshot' })));
	});

	it('YAML export: the same document after parsing; bytes compared and logged (js-yaml 4.3.2 against 4.1.1)', async () => {
		const req = asAdmin({ path: '/schema/snapshot?export=yaml' });
		const [d, b] = await Promise.all([
			capture(process.env['DIRECTUS_URL']!, req),
			capture(process.env['BACKOFFICE_URL']!, req),
		]);

		expect(b.status).toBe(d.status);
		expect(loadYaml(b.text)).toEqual(loadYaml(d.text));
		// eslint-disable-next-line no-console -- T038: whether the YAML bytes match, read from the CI log
		console.info(`[T038] ${vendor} YAML snapshot bytes equal: ${b.text === d.text}`);
	});

	it('a snapshot of one app diffed at the other: 204 both ways', async () => {
		for (const [from, to] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const snapshot = (await appRequest(from, 'GET', '/schema/snapshot')).data;
			const res = await fetch(
				new URL('/schema/diff', process.env[to === 'directus' ? 'DIRECTUS_URL' : 'BACKOFFICE_URL']),
				{
					method: 'POST',
					headers: { authorization: `Bearer ${await adminToken(to)}`, 'content-type': 'application/json' },
					body: JSON.stringify(snapshot),
				},
			);
			expect(res.status, `${from} → ${to}`).toBe(204);
		}
	});

	it('errors: non-admin 403, invalid snapshots and their force rules, bodies and media types', async () => {
		const user = await createUser('directus', 'parity-sm-schema');
		const snapshot = (await appRequest('directus', 'GET', '/schema/snapshot')).data;

		for (const req of [
			{ path: '/schema/snapshot', headers: { authorization: `Bearer ${user.token}` } },
			{ method: 'POST', path: '/schema/diff', headers: { authorization: `Bearer ${user.token}` }, body: snapshot },
			{ path: '/schema/snapshot' },
		] as ParityRequest[]) {
			assertParity(await parity(req));
		}

		for (const [query, body] of [
			['', { ...snapshot, version: 2 }],
			['', { ...snapshot, directus: '11.16.0' }],
			['?force', { ...snapshot, directus: '11.16.0' }],
			['?force=false', { ...snapshot, directus: '11.16.0' }],
			['', { ...snapshot, vendor: undefined }],
			['', { ...snapshot, vendor: vendor === 'postgres' ? 'mysql' : 'postgres' }],
			['', { ...snapshot, fields: [{ collection: A, field: 'x', type: 'nope', meta: null, schema: null }] }],
			['', {}],
		] as const) {
			assertParity(await parity(asAdmin({ method: 'POST', path: `/schema/diff${query}`, body })));
		}

		assertParity(
			await parity(
				asAdmin({ method: 'POST', path: '/schema/diff', headers: { 'content-type': 'text/plain' }, body: 'x' }),
			),
		);
		assertParity(await parity(asAdmin({ method: 'POST', path: '/schema/apply', body: { hash: 'x' } })));
	});
});

describe('diff and apply (FR-041 to FR-043)', () => {
	let target: unknown;
	let payload: { hash: string; diff: unknown };

	beforeAll(async () => {
		// The target snapshot, then the diff from the starting model to it, both through Directus.
		await startingModel();
		await changeModel();
		target = (await directusRequest('GET', '/schema/snapshot')).data;

		await cleanupTables('directus', TABLES);
		await resetSystemIndex();
		await startingModel();
		payload = (await directusRequest('POST', '/schema/diff', target)).data;
		await cleanupTables('directus', TABLES);
	}, 180_000);

	it('the same diff and hash at both apps', async () => {
		await startingModel();

		try {
			assertParity(
				await parity(asAdmin({ method: 'POST', path: '/schema/diff', body: target as Record<string, unknown> })),
			);
			const fromBackoffice = (await appRequest('backoffice', 'POST', '/schema/diff', target)).data;
			expect(fromBackoffice).toEqual(payload);
		} finally {
			await cleanupTables('directus', TABLES);
		}
	});

	it('apply from the same starting model: same responses, DDL and metadata; the target snapshot afterwards', async () => {
		const { directus, backoffice } = await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/schema/apply', body: payload },
				{ path: '/schema/snapshot', headers: fresh },
				{ method: 'POST', path: '/schema/diff', body: target as Record<string, unknown> },
				{ method: 'POST', path: '/schema/apply', body: payload },
			],
			{ tables: TABLES, setup: () => startingModel(), cleanup: () => resetSystemIndex() },
		);

		expect(directus.responses[0]!.status).toBe(204);
		expect(directus.responses[2]!.status).toBe(204);
		expect(backoffice.responses[3]!.status).toBe(400);
	});

	it('apply a diff made at the other app (multipart YAML at the new app)', async () => {
		await startingModel();

		try {
			const yaml = (await import('js-yaml')).dump(payload);
			const form = new FormData();
			form.append('file', new Blob([yaml], { type: 'text/yaml' }), 'diff.yaml');

			await appRequest('backoffice', 'POST', '/schema/apply', form);
			const applied = (await appRequest('directus', 'GET', '/schema/snapshot')).data;
			expect(applied).toEqual(target);
		} finally {
			await cleanupTables('directus', TABLES);
			await resetSystemIndex();
		}
	});

	it('hash and diff errors: every detailed reason of validateApplyDiff, force', async () => {
		await startingModel();

		try {
			const create = { collection: A, diff: [{ kind: 'N', rhs: { collection: A, meta: {}, schema: { name: A } } }] };
			const deleteMissing = { collection: 'nope', diff: [{ kind: 'D', lhs: { collection: 'nope' } }] };
			const empty = { collections: [], fields: [], systemFields: [], relations: [] };

			for (const body of [
				{ hash: 'stale', diff: { ...empty, collections: [create] } },
				{ hash: 'stale', diff: { ...empty, collections: [deleteMissing] } },
				{
					hash: 'stale',
					diff: { ...empty, fields: [{ collection: A, field: 'title', diff: [{ kind: 'N', rhs: {} }] }] },
				},
				{
					hash: 'stale',
					diff: {
						...empty,
						systemFields: [{ collection: 'directus_users', field: 'title', diff: [{ kind: 'N', rhs: {} }] }],
					},
				},
				{
					hash: 'stale',
					diff: {
						...empty,
						systemFields: [
							{
								collection: 'directus_users',
								field: 'title',
								diff: [{ kind: 'E', path: ['schema', 'is_unique'], lhs: false, rhs: true }],
							},
						],
					},
				},
				{
					hash: 'stale',
					diff: {
						...empty,
						relations: [{ collection: A, field: 'b', related_collection: B, diff: [{ kind: 'N', rhs: {} }] }],
					},
				},
				{ hash: 'stale', diff: payload.diff },
				{ hash: 'stale', diff: empty },
				{ diff: empty },
			]) {
				assertParity(await parity(asAdmin({ method: 'POST', path: '/schema/apply', body })));
			}
		} finally {
			await cleanupTables('directus', TABLES);
		}
	});
});
