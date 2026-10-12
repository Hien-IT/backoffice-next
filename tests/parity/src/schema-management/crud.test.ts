// Feature 006, US1 and US2 HTTP contract (FR-001 to FR-003, FR-010 to FR-013, FR-020 to FR-024, FR-030 to FR-032,
// contracts/schema-api.md): reads go to both apps at once (parity()); writes run in sequence with the same names on
// the shared database (ddlScenario(), research R5): responses, DDL and metadata rows must be equal.
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knexConfig } from '../config.js';
import { adminToken, appRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { assertParity, parity, type ParityRequest } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createUser,
	createUserCollection,
	type TestUser,
} from '../permissions/fixtures.js';
import { cleanupTables, ddlScenario } from './ddl-scenario.js';

const [vendor] = getDbsToTest();
const P = 'parity_sm_crud';
const PERM = `${P}_perm`;

let db: Knex;
let admin: string;
let reader: TestUser;

const as = (token: string, req: ParityRequest): ParityRequest => ({
	...req,
	headers: { authorization: `Bearer ${token}`, ...req.headers },
});

async function same(req: ParityRequest) {
	assertParity(await parity(req));
}

beforeAll(async () => {
	db = knex(knexConfig[vendor!]);
	admin = await adminToken('directus');

	await createUserCollection(PERM, [
		{ field: 'title', type: 'string', meta: {} },
		{ field: 'secret', type: 'string', meta: {} },
	]);

	// A user who reads two fields of one collection: /collections, /fields and /relations are filtered (FR-002).
	const policy = await createPolicy('directus', 'parity-sm-reader', {
		permissions: [{ collection: PERM, action: 'read', fields: ['id', 'title'] } as any],
	});
	reader = await createUser('directus', 'parity-sm-reader');
	await attachPolicy('directus', policy, { user: reader.id });
}, 120_000);

afterAll(async () => {
	await cleanup();
	await db.destroy();
}, 120_000);

describe('reads (both apps at once)', () => {
	it.each([
		'/collections',
		'/collections/directus_users',
		`/collections/${PERM}`,
		'/collections/nope',
		'/collections?limit=abc',
		'/collections?limit=1&sort=-collection',
		'/fields',
		'/fields/directus_users',
		`/fields/${PERM}`,
		`/fields/${PERM}/title`,
		'/fields/nope',
		`/fields/${PERM}/nope`,
		'/relations',
		'/relations/directus_users',
		'/relations/directus_users/role',
		'/relations/nope',
		'/relations/directus_users/nope',
	])('admin GET %s', async (path) => {
		await same(as(admin, { path }));
	});

	it('SEARCH /collections with keys, with an invalid body; HEAD and OPTIONS', async () => {
		await same(as(admin, { method: 'SEARCH', path: '/collections', body: { keys: ['directus_users', PERM] } }));
		await same(as(admin, { method: 'SEARCH', path: '/collections', body: { keys: 'x' } }));
		await same(as(admin, { method: 'HEAD', path: '/fields/directus_users' }));

		for (const path of [
			'/collections',
			'/collections/x',
			'/fields',
			'/fields/x',
			'/fields/x/y',
			'/relations',
			'/relations/x',
			'/relations/x/y',
		]) {
			await same({ method: 'OPTIONS', path });
		}
	});

	it.each([
		'/collections',
		`/collections/${PERM}`,
		'/fields',
		`/fields/${PERM}`,
		'/relations',
		`/fields/${PERM}/secret`,
	])('user with two readable fields: GET %s', async (path) => {
		await same(as(reader.token, { path }));
	});

	it('public: reads answer 403 or the public subset, writes 403', async () => {
		await same({ path: '/collections' });
		await same({ path: '/fields' });
		await same({ path: '/relations' });
		await same({ method: 'POST', path: '/collections', body: { collection: `${P}_public`, schema: {} } });
	});

	it('non-admin writes: 403 before any check', async () => {
		for (const req of [
			{ method: 'POST', path: '/collections', body: { collection: `${P}_denied`, schema: {} } },
			{ method: 'PATCH', path: `/collections/${PERM}`, body: { meta: { note: 'x' } } },
			{ method: 'DELETE', path: `/collections/${PERM}` },
			{ method: 'POST', path: `/fields/${PERM}`, body: { field: 'x', type: 'string' } },
			{ method: 'PATCH', path: `/fields/${PERM}/title`, body: { meta: { note: 'x' } } },
			{ method: 'DELETE', path: `/fields/${PERM}/title` },
			{ method: 'POST', path: '/relations', body: { collection: PERM, field: 'title' } },
		]) {
			await same(as(reader.token, req));
		}
	});
});

describe('collections (in sequence on the shared database)', () => {
	const C = `${P}_c`;

	it('POST with fields, GET, PATCH meta, PATCH batch, DELETE, GET after', async () => {
		await ddlScenario(
			db,
			[
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: C,
						schema: {},
						meta: { icon: 'article', note: 'parity' },
						fields: [
							{
								field: 'id',
								type: 'integer',
								meta: { hidden: true },
								schema: { is_primary_key: true, has_auto_increment: true },
							},
							{ field: 'title', type: 'string', meta: { interface: 'input' } },
							{ field: 'body', type: 'text' },
						],
					},
				},
				{ path: `/collections/${C}` },
				{ method: 'PATCH', path: `/collections/${C}`, body: { meta: { note: 'changed', sort: 3 } } },
				{ method: 'PATCH', path: `/collections/${C}`, body: { schema: { name: 'ignored' } } },
				{ method: 'PATCH', path: '/collections', body: [{ collection: C, meta: { sort: 1 } }] },
				{ method: 'PATCH', path: '/collections', body: { collection: C } },
				{ path: `/fields/${C}` },
			],
			{ tables: [C] },
		);
	});

	it('no fields: an injected id; a uuid or string primary key; a folder; an array of collections', async () => {
		await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/collections', body: { collection: `${C}_auto`, schema: {}, meta: {} } },
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: `${C}_uuid`,
						schema: {},
						meta: {},
						fields: [{ field: 'id', type: 'uuid', meta: { special: ['uuid'] }, schema: { is_primary_key: true } }],
					},
				},
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: `${C}_str`,
						schema: {},
						fields: [{ field: 'code', type: 'string', schema: { is_primary_key: true, max_length: 20 } }],
					},
				},
				{
					method: 'POST',
					path: '/collections',
					body: { collection: `${C}_folder`, schema: null, meta: { icon: 'folder' } },
				},
				{
					method: 'POST',
					path: '/collections',
					body: [
						{ collection: `${C}_many1`, schema: {}, meta: { group: `${C}_folder` } },
						{ collection: `${C}_many2`, schema: {}, meta: {} },
					],
				},
				{ path: `/collections/${C}_folder` },
				{ method: 'DELETE', path: `/collections/${C}_folder` },
				{ path: `/collections/${C}_many1` },
			],
			{ tables: [`${C}_auto`, `${C}_uuid`, `${C}_str`, `${C}_folder`, `${C}_many1`, `${C}_many2`] },
		);
	});

	it('errors: names, duplicates, fields not an array, an array that fails half way (rolled back)', async () => {
		await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/collections', body: {} },
				{ method: 'POST', path: '/collections', body: { collection: '' } },
				{ method: 'POST', path: '/collections', body: { collection: 'directus_parity' } },
				{ method: 'POST', path: '/collections', body: { collection: 'parity/sm' } },
				{ method: 'POST', path: '/collections', body: { collection: C, schema: {}, fields: 'id' } },
				{ method: 'POST', path: '/collections', body: { collection: C, schema: {} } },
				{ method: 'POST', path: '/collections', body: { collection: C, schema: {} } },
				{ method: 'POST', path: '/collections', body: { collection: 'directus_users', schema: {} } },
				{
					method: 'POST',
					path: '/collections',
					body: [
						{ collection: `${C}_ok`, schema: {} },
						{ collection: `${C}_bad`, schema: {}, fields: [{ field: 'x', type: 'nope' }] },
					],
				},
				{ path: `/collections/${C}_ok` },
				{ method: 'DELETE', path: '/collections/nope' },
			],
			{ tables: [C, `${C}_ok`, `${C}_bad`] },
		);
	});

	it.skipIf(vendor === 'sqlite3')(
		'R-11: PATCH /collections/directus_users adds a metadata row like Directus',
		async () => {
			// Host writes are not possible on SQLite in CI (memory: bind mount permissions); the row is removed from the host.
			const removeRow = async () => db('directus_collections').where({ collection: 'directus_users' }).delete();

			await ddlScenario(
				db,
				[
					{ method: 'PATCH', path: '/collections/directus_users', body: { meta: { note: 'parity R-11' } } },
					{ path: '/collections/directus_users' },
				],
				{ tables: ['directus_users'], cleanup: removeRow },
			);
		},
	);

	it('D-32: DELETE /collections/<system collection> answers 403 at the new app and keeps the table', async () => {
		// Never sent to Directus: it drops the table of the shared database (spec 006, D-32, measured at T010).
		const token = await adminToken('backoffice');
		const res = await fetch(new URL('/collections/directus_notifications', process.env['BACKOFFICE_URL']), {
			method: 'DELETE',
			headers: { authorization: `Bearer ${token}` },
		});

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			errors: [{ message: "You don't have permission to access this.", extensions: { code: 'FORBIDDEN' } }],
		});
		expect(await db.schema.hasTable('directus_notifications')).toBe(true);
	});
});

describe('fields (in sequence on the shared database)', () => {
	const F = `${P}_f`;

	beforeAll(async () => {
		await cleanupTables('directus', [F]);
	});

	it('POST, GET, PATCH one, PATCH batch (second item fails, first kept), DELETE; errors', async () => {
		await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/collections', body: { collection: F, schema: {}, meta: {} } },
				{
					method: 'POST',
					path: `/fields/${F}`,
					body: { field: 'title', type: 'string', meta: { interface: 'input' } },
				},
				{
					method: 'POST',
					path: `/fields/${F}`,
					body: { field: 'rating', type: 'integer', schema: { default_value: 3 } },
				},
				{ method: 'POST', path: `/fields/${F}`, body: { field: 'title', type: 'string' } },
				{ method: 'POST', path: `/fields/${F}`, body: { type: 'string' } },
				{ method: 'POST', path: `/fields/${F}`, body: { field: 'x', type: 'nope' } },
				{ method: 'POST', path: `/fields/${F}`, body: { field: 'x', type: 'string', schema: { max_length: true } } },
				{ method: 'POST', path: '/fields/nope', body: { field: 'x', type: 'string' } },
				{ path: `/fields/${F}/title` },
				{
					method: 'PATCH',
					path: `/fields/${F}/title`,
					body: { meta: { note: 'changed' }, schema: { max_length: 100 } },
				},
				{ method: 'PATCH', path: `/fields/${F}/title`, body: { field: 'renamed', meta: { note: 'body field' } } },
				{ method: 'PATCH', path: `/fields/${F}/title`, body: { type: 'alias' } },
				{ method: 'PATCH', path: `/fields/${F}/id`, body: { schema: { is_nullable: true } } },
				{ method: 'PATCH', path: `/fields/${F}`, body: { field: 'title' } },
				{
					method: 'PATCH',
					path: `/fields/${F}`,
					body: [
						{ field: 'title', meta: { note: 'batch' } },
						{ field: 'rating', type: 'alias' },
					],
				},
				{ method: 'PATCH', path: `/fields/${F}`, body: [] },
				{ path: `/fields/${F}` },
				{ method: 'DELETE', path: `/fields/${F}/rating` },
				{ method: 'DELETE', path: `/fields/${F}/nope` },
			],
			{ tables: [F] },
		);
	});

	it('system fields: is_indexed on and off, other keys 400, DELETE 403; a user field in directus_users', async () => {
		const removeUserField = async (app: 'directus' | 'backoffice') => {
			await appRequest(app, 'DELETE', `/fields/directus_users/${P}_nick`).catch(() => undefined);
		};

		await ddlScenario(
			db,
			[
				{ method: 'PATCH', path: '/fields/directus_users/title', body: { schema: { is_indexed: true } } },
				{ method: 'PATCH', path: '/fields/directus_users/title', body: { schema: { is_indexed: false } } },
				{ method: 'PATCH', path: '/fields/directus_users/title', body: { schema: { is_unique: true } } },
				{ method: 'PATCH', path: '/fields/directus_users/title', body: { meta: { note: 'x' } } },
				{ method: 'PATCH', path: '/fields/directus_users', body: [{ field: 'title', schema: { is_nullable: false } }] },
				{ method: 'DELETE', path: '/fields/directus_users/title' },
				{
					method: 'POST',
					path: '/fields/directus_users',
					body: { field: `${P}_nick`, type: 'string', meta: { interface: 'input' } },
				},
				{ method: 'PATCH', path: `/fields/directus_users/${P}_nick`, body: { schema: { max_length: 40 } } },
				{ path: `/fields/directus_users/${P}_nick` },
				{ method: 'DELETE', path: `/fields/directus_users/${P}_nick` },
			],
			{ tables: ['directus_users'], cleanup: removeUserField },
		);
	});
});
