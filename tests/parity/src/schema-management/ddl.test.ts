// Feature 006, FR-020 to FR-024 and FR-060 (contracts/ddl.md): the DDL and the metadata each app leaves for every field
// type and schema option, through both paths (CREATE TABLE with the collection, ALTER TABLE ADD with POST /fields),
// changes on columns that hold data, and the clean-up of a deleted collection. In sequence on the shared database with
// the same names (research R5): see ddl-scenario.ts.
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { knexConfig } from '../config.js';
import { type AppName, adminToken, appRequest, directusRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import type { ParityRequest } from '../parity.js';
import { cleanupTables, ddlScenario } from './ddl-scenario.js';

// Each case runs every request twice in sequence, slower on SQLite (Knex rebuilds the table on ALTER) and with
// the emulated Directus image.
vi.setConfig({ testTimeout: 180_000 });

const [vendor] = getDbsToTest();
const P = 'parity_sm_ddl';

/** Field types of contracts/ddl.md §2 with a column (alias types are in relations.test.ts). */
const TYPES = [
	'bigInteger',
	'boolean',
	'date',
	'dateTime',
	'decimal',
	'float',
	'integer',
	'json',
	'string',
	'text',
	'time',
	'timestamp',
	'binary',
	'uuid',
	'hash',
	'csv',
	'geometry',
	'geometry.Point',
	'geometry.LineString',
	'geometry.Polygon',
	'geometry.MultiPoint',
	'geometry.MultiLineString',
	'geometry.MultiPolygon',
] as const;

const name = (type: string) => `f_${type.replace('.', '_').toLowerCase()}`;
const field = (type: string, extra: Record<string, unknown> = {}) => ({ field: name(type), type, meta: {}, ...extra });

let db: Knex;

beforeAll(() => {
	db = knex(knexConfig[vendor!]);
});

afterAll(async () => {
	await db.destroy();
});

describe('every type (FR-020)', () => {
	const T = `${P}_types`;
	const A = `${P}_alter`;

	it('CREATE TABLE with the collection: every type, default schema options', async () => {
		await ddlScenario(
			db,
			[
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: T,
						schema: {},
						meta: {},
						fields: [
							{
								field: 'id',
								type: 'integer',
								meta: { hidden: true },
								schema: { is_primary_key: true, has_auto_increment: true },
							},
							...TYPES.map((t) => field(t)),
						],
					},
				},
				{ path: `/fields/${T}` },
			],
			{ tables: [T] },
		);
	});

	it('ALTER TABLE ADD with POST /fields: every type, then GET', async () => {
		await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/collections', body: { collection: A, schema: {}, meta: {} } },
				...TYPES.flatMap((t): ParityRequest[] => [
					{ method: 'POST', path: `/fields/${A}`, body: field(t) },
					{ path: `/fields/${A}/${name(t)}` },
				]),
			],
			{ tables: [A] },
		);
	});
});

describe('schema options (FR-020)', () => {
	const O = `${P}_options`;

	it('length, precision, scale, nullable, defaults, unique, index, both, through both paths', async () => {
		const options: Record<string, unknown>[] = [
			{ field: 'len', type: 'string', meta: {}, schema: { max_length: 40 } },
			{ field: 'len_null', type: 'string', meta: {}, schema: { max_length: null } },
			{ field: 'len_text', type: 'string', meta: {}, schema: { max_length: '64' } },
			{ field: 'num', type: 'decimal', meta: {}, schema: { numeric_precision: 12, numeric_scale: 3 } },
			{ field: 'flt', type: 'float', meta: {}, schema: { numeric_precision: 8, numeric_scale: 2 } },
			{ field: 'req', type: 'integer', meta: {}, schema: { is_nullable: false, default_value: 7 } },
			{ field: 'flag', type: 'boolean', meta: {}, schema: { default_value: true } },
			{ field: 'word', type: 'string', meta: {}, schema: { default_value: 'draft' } },
			{ field: 'uniq', type: 'string', meta: {}, schema: { is_unique: true } },
			{ field: 'idx', type: 'integer', meta: {}, schema: { is_indexed: true } },
			{ field: 'both', type: 'string', meta: {}, schema: { is_unique: true, is_indexed: true } },
			{ field: 'now_ts', type: 'timestamp', meta: {}, schema: { default_value: 'now()' } },
			{ field: 'now_dt', type: 'dateTime', meta: {}, schema: { default_value: 'CURRENT_TIMESTAMP' } },
			{ field: 'now_p', type: 'timestamp', meta: {}, schema: { default_value: 'CURRENT_TIMESTAMP(3)' } },
		];

		await ddlScenario(
			db,
			[
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: O,
						schema: {},
						meta: {},
						fields: [
							{
								field: 'id',
								type: 'integer',
								meta: { hidden: true },
								schema: { is_primary_key: true, has_auto_increment: true },
							},
							...options,
						],
					},
				},
				...options.map(
					(o): ParityRequest => ({ method: 'POST', path: `/fields/${O}`, body: { ...o, field: `${o['field']}_add` } }),
				),
				{ path: `/fields/${O}` },
			],
			{ tables: [O] },
		);
	});

	it('gen_random_uuid() (a database function; an error where the vendor has none), concurrent indexes', async () => {
		await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/collections', body: { collection: O, schema: {}, meta: {} } },
				{
					method: 'POST',
					path: `/fields/${O}`,
					body: { field: 'gen', type: 'uuid', meta: {}, schema: { default_value: 'gen_random_uuid()' } },
				},
				{
					method: 'POST',
					path: `/fields/${O}?concurrentIndexCreation`,
					body: { field: 'cidx', type: 'integer', meta: {}, schema: { is_indexed: true } },
				},
				{
					method: 'POST',
					path: `/fields/${O}?concurrentIndexCreation=true`,
					body: { field: 'cuniq', type: 'string', meta: {}, schema: { is_unique: true } },
				},
				{
					method: 'POST',
					path: `/fields/${O}?concurrentIndexCreation=false`,
					body: { field: 'nidx', type: 'integer', meta: {}, schema: { is_indexed: true } },
				},
				{
					method: 'PATCH',
					path: `/fields/${O}/cidx?concurrentIndexCreation`,
					body: { schema: { is_indexed: false, is_unique: true } },
				},
				{ path: `/fields/${O}` },
			],
			{ tables: [O] },
		);
	});

	it('primary keys: auto-increment integer and big integer, uuid, string', async () => {
		const pk = (type: string, schema: Record<string, unknown>) => ({
			field: 'id',
			type,
			meta: { hidden: true },
			schema: { is_primary_key: true, ...schema },
		});

		await ddlScenario(
			db,
			[
				{
					method: 'POST',
					path: '/collections',
					body: { collection: `${O}_int`, schema: {}, meta: {}, fields: [pk('integer', { has_auto_increment: true })] },
				},
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: `${O}_big`,
						schema: {},
						meta: {},
						fields: [pk('bigInteger', { has_auto_increment: true })],
					},
				},
				{
					method: 'POST',
					path: '/collections',
					body: { collection: `${O}_uuid`, schema: {}, meta: {}, fields: [pk('uuid', {})] },
				},
				{
					method: 'POST',
					path: '/collections',
					body: { collection: `${O}_str`, schema: {}, meta: {}, fields: [pk('string', { max_length: 32 })] },
				},
			],
			{ tables: [`${O}_int`, `${O}_big`, `${O}_uuid`, `${O}_str`] },
		);
	});
});

describe('changes on columns that hold data (FR-022, US1.4)', () => {
	const D = `${P}_data`;

	it('type, length, nullable, default, unique, index; errors keep status and code', async () => {
		const steps: ParityRequest[] = [
			{
				method: 'POST',
				path: '/collections',
				body: {
					collection: D,
					schema: {},
					meta: {},
					fields: [
						{
							field: 'id',
							type: 'integer',
							meta: { hidden: true },
							schema: { is_primary_key: true, has_auto_increment: true },
						},
						{ field: 'title', type: 'string', meta: {} },
						{ field: 'code', type: 'string', meta: {} },
						{ field: 'qty', type: 'integer', meta: {} },
						{ field: 'note', type: 'string', meta: {} },
					],
				},
			},
			{
				method: 'POST',
				path: `/items/${D}`,
				body: [
					{ title: 'alpha', code: 'a', qty: 1, note: null },
					{ title: 'a much longer title', code: 'a', qty: 2, note: 'x' },
				],
			},
			{ method: 'PATCH', path: `/fields/${D}/title`, body: { type: 'text' } },
			{ method: 'PATCH', path: `/fields/${D}/qty`, body: { type: 'float' } },
			{ method: 'PATCH', path: `/fields/${D}/code`, body: { type: 'integer' } },
			{ method: 'PATCH', path: `/fields/${D}/code`, body: { schema: { max_length: 300 } } },
			{ method: 'PATCH', path: `/fields/${D}/code`, body: { schema: { is_unique: true } } },
			{ method: 'PATCH', path: `/fields/${D}/note`, body: { schema: { is_nullable: false } } },
			{ method: 'PATCH', path: `/fields/${D}/note`, body: { schema: { default_value: 'n/a' } } },
			{ method: 'PATCH', path: `/fields/${D}/note`, body: { schema: { is_indexed: true } } },
			{ method: 'PATCH', path: `/fields/${D}/note`, body: { schema: { is_indexed: false } } },
			{
				method: 'PATCH',
				path: `/fields/${D}/qty`,
				body: { type: 'integer', schema: { is_nullable: false, default_value: 0 } },
			},
			{ path: `/items/${D}?sort=id&fields=*` },
			{ path: `/fields/${D}` },
		];

		await ddlScenario(db, steps, { tables: [D] });
	});
});

describe('names (Edge Cases)', () => {
	it('spaces and capitals; a name longer than the vendor limit', async () => {
		const long = `${P}_${'x'.repeat(70)}`;

		await ddlScenario(
			db,
			[
				{ method: 'POST', path: '/collections', body: { collection: `${P} Spaced`, schema: {}, meta: {} } },
				{ path: `/collections/${encodeURIComponent(`${P} Spaced`)}` },
				{ path: `/fields/${encodeURIComponent(`${P} Spaced`)}` },
				{ method: 'POST', path: '/collections', body: { collection: `${P}_Caps`, schema: {}, meta: {} } },
				{ path: `/fields/${P}_Caps` },
				{ method: 'POST', path: '/collections', body: { collection: long, schema: {}, meta: {} } },
			],
			{ tables: [`${P} Spaced`, `${P}_Caps`, long] },
		);
	});
});

describe('deleting a collection with what depends on it (FR-013, FR-023)', () => {
	const C = `${P}_del`;
	const CHILD = `${P}_del_child`;
	const OTHER = `${P}_del_other`;
	const J = `${P}_del_j`;
	const pk = {
		field: 'id',
		type: 'integer',
		meta: { hidden: true },
		schema: { is_primary_key: true, has_auto_increment: true },
	};
	const count = async (query: Knex.QueryBuilder) => Number((await query.count({ n: '*' }).first())?.['n']);

	/** What the deletion must clean or keep, read from the shared database after DELETE /collections/C. */
	async function leftovers() {
		return {
			table: await db.schema.hasTable(C),
			presets: await count(db('directus_presets').where('collection', C)),
			revisions: await count(db('directus_revisions').where('collection', C)),
			activity: await count(db('directus_activity').where('collection', C)),
			permissions: await count(db('directus_permissions').where('collection', C)),
			shares: await count(db('directus_shares').where('collection', C)),
			versions: await count(db('directus_versions').where('collection', C)),
			relations: (await db('directus_relations').whereIn('many_collection', [C, OTHER, J]).orderBy('many_field')).map(
				({ id: _id, ...r }) => r,
			),
			fields: (
				await db('directus_fields').whereIn('collection', [C, OTHER, CHILD]).orderBy(['collection', 'field'])
			).map((f) => `${f.collection}.${f.field}`),
			meta: await db('directus_collections')
				.whereIn('collection', [C, OTHER, CHILD])
				.orderBy('collection')
				.select('collection', 'item_duplication_fields', 'group'),
			permissionFields: (await db('directus_permissions').where('collection', OTHER).select('fields')).map(
				(p) => p.fields,
			),
		};
	}

	async function build(app: AppName, fkFromOther: boolean) {
		await cleanupTables(app, [C, CHILD, OTHER, J]);

		await appRequest(app, 'POST', '/collections', {
			collection: OTHER,
			schema: {},
			meta: { item_duplication_fields: ['title', 'cs', 'cs.title'] },
			fields: [
				pk,
				{ field: 'title', type: 'string', meta: {} },
				{ field: 'parent', type: 'integer', meta: { special: ['m2o'] } },
			],
		});

		await appRequest(app, 'POST', '/collections', {
			collection: C,
			schema: {},
			meta: { versioning: true },
			fields: [
				pk,
				{ field: 'title', type: 'string', meta: {} },
				{ field: 'ref', type: 'integer', meta: { special: ['m2o'] } },
			],
		});

		await appRequest(app, 'POST', '/collections', { collection: CHILD, schema: {}, meta: { group: C } });

		// C.ref → OTHER with the o2m alias OTHER.cs: deleting C deletes OTHER.cs and prunes item_duplication_fields.
		await appRequest(app, 'POST', `/fields/${OTHER}`, { field: 'cs', type: 'alias', meta: { special: ['o2m'] } });
		await appRequest(app, 'POST', '/relations', {
			collection: C,
			field: 'ref',
			related_collection: OTHER,
			meta: { one_field: 'cs' },
		});

		// m2a: C leaves one_allowed_collections.
		await appRequest(app, 'POST', '/collections', {
			collection: J,
			schema: {},
			meta: {},
			fields: [pk, { field: 'item', type: 'string', meta: {} }, { field: 'collection', type: 'string', meta: {} }],
		});
		await appRequest(app, 'POST', '/relations', {
			collection: J,
			field: 'item',
			related_collection: null,
			meta: { one_allowed_collections: [C, OTHER], one_collection_field: 'collection' },
		});

		if (fkFromOther) {
			await appRequest(app, 'POST', '/relations', { collection: OTHER, field: 'parent', related_collection: C });
		}

		// Items make activity and revisions (one with a parent); a preset, a share and a version through Directus
		// (/presets, /shares are feature 010, /versions 008); permissions through the app.
		const item = await appRequest(app, 'POST', `/items/${C}`, { title: 'a' });
		await appRequest(app, 'PATCH', `/items/${C}/${item.data.id}`, { title: 'b' });
		await directusRequest('POST', '/presets', { collection: C, layout: 'tabular' });
		await directusRequest('POST', '/shares', { name: 'parity', collection: C, item: String(item.data.id) });
		await directusRequest('POST', '/versions', { name: 'v', key: 'v1', collection: C, item: String(item.data.id) });

		const policy = await appRequest(app, 'POST', '/policies', {
			name: `${P}-${app}`,
			app_access: false,
			admin_access: false,
			permissions: [
				{ collection: C, action: 'read', fields: ['*'] },
				{ collection: OTHER, action: 'read', fields: ['title', 'cs', 'parent'] },
			],
		});

		return policy.data.id as string;
	}

	async function deleteAndRead(app: AppName, fkFromOther: boolean) {
		const policy = await build(app, fkFromOther);

		const res = await fetch(
			new URL(`/collections/${C}`, process.env[app === 'directus' ? 'DIRECTUS_URL' : 'BACKOFFICE_URL']),
			{
				method: 'DELETE',
				headers: { authorization: `Bearer ${await adminToken(app)}` },
			},
		);

		const out = { status: res.status, ...(await leftovers()) };

		await appRequest(app, 'DELETE', `/policies/${policy}`);
		if (fkFromOther) await appRequest(app, 'DELETE', `/relations/${OTHER}/parent`).catch(() => undefined);
		await cleanupTables(app, [C, CHILD, OTHER, J]);
		await directusRequest('DELETE', `/presets?filter[collection][_eq]=${C}`).catch(() => undefined);
		return out;
	}

	it('presets, revisions, activity, permissions, shares, versions, o2m, m2a, duplication fields, group: same clean-up, 204', async () => {
		const directus = await deleteAndRead('directus', false);
		const backoffice = await deleteAndRead('backoffice', false);

		expect(directus).toMatchObject({ status: 204, table: false, presets: 0, permissions: 0, shares: 0, versions: 0 });
		expect(backoffice).toEqual(directus);
	});

	it('another table has a foreign key to it: the DROP TABLE fails at both apps (500, not on SQLite)', async () => {
		const directus = await deleteAndRead('directus', true);
		const backoffice = await deleteAndRead('backoffice', true);

		// SQLite drops a table that others still point at (foreign keys are not checked on DROP TABLE there).
		if (vendor !== 'sqlite3') expect(directus).toMatchObject({ status: 500, table: true });
		expect(backoffice).toEqual(directus);
	});
});
