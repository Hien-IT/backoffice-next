// Feature 006, US2 (FR-021, FR-023, FR-030 to FR-032, contracts/ddl.md §3, §4): relations and alias fields made the way
// the Directus app makes them (field requests then relation requests), their foreign keys and metadata, changes and
// deletions, in sequence on the shared database with the same names (ddl-scenario.ts).
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { knexConfig } from '../config.js';
import { appRequest } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import type { ParityRequest } from '../parity.js';
import { ddlScenario } from './ddl-scenario.js';

const [vendor] = getDbsToTest();
const P = 'parity_sm_rel';
const A = `${P}_a`;
const B = `${P}_b`;
const C = `${P}_c`;

const pk = {
	field: 'id',
	type: 'integer',
	meta: { hidden: true },
	schema: { is_primary_key: true, has_auto_increment: true },
};
const collection = (name: string, fields: Record<string, unknown>[] = []): ParityRequest => ({
	method: 'POST',
	path: '/collections',
	body: { collection: name, schema: {}, meta: {}, fields: [pk, ...fields] },
});
const addField = (name: string, body: Record<string, unknown>): ParityRequest => ({
	method: 'POST',
	path: `/fields/${name}`,
	body,
});
const relation = (body: Record<string, unknown>): ParityRequest => ({ method: 'POST', path: '/relations', body });

let db: Knex;

beforeAll(() => {
	db = knex(knexConfig[vendor!]);
});

afterAll(async () => {
	await db.destroy();
});

describe('m2o and o2m (FR-030, FR-031, FR-023)', () => {
	it.each(['NO ACTION', 'SET NULL', 'SET DEFAULT', 'CASCADE', 'RESTRICT'])(
		'on_delete %s, on_update CASCADE',
		async (onDelete) => {
			await ddlScenario(
				db,
				[
					collection(B),
					collection(A, [
						{ field: 'b', type: 'integer', meta: { special: ['m2o'], interface: 'select-dropdown-m2o' } },
					]),
					relation({
						collection: A,
						field: 'b',
						related_collection: B,
						schema: { on_delete: onDelete, on_update: 'CASCADE' },
					}),
					{ path: `/relations/${A}/b` },
					{ path: `/relations/${A}` },
				],
				{ tables: [B, A] },
			);
		},
	);

	it('o2m alias on the other side; PATCH on_delete and meta; delete the o2m field, then the m2o field', async () => {
		await ddlScenario(
			db,
			[
				collection(B),
				collection(A, [{ field: 'b', type: 'integer', meta: { special: ['m2o'] } }]),
				addField(B, { field: 'as', type: 'alias', meta: { special: ['o2m'], interface: 'list-o2m' } }),
				relation({
					collection: A,
					field: 'b',
					related_collection: B,
					meta: { one_field: 'as', sort_field: null },
					schema: { on_delete: 'SET NULL' },
				}),
				{ path: `/fields/${B}/as` },
				{
					method: 'PATCH',
					path: `/relations/${A}/b`,
					body: {
						collection: A,
						field: 'b',
						related_collection: B,
						schema: { on_delete: 'CASCADE' },
						meta: { one_deselect_action: 'delete' },
					},
				},
				{ method: 'PATCH', path: `/relations/${A}/b`, body: { schema: { on_delete: 'CASCADE' } } },
				{ method: 'PATCH', path: `/relations/${A}/b`, body: { schema: { on_delete: 'NOPE' } } },
				{ method: 'DELETE', path: `/fields/${B}/as` },
				{ path: `/relations/${A}/b` },
				{ method: 'DELETE', path: `/fields/${A}/b` },
				{ path: `/relations/${A}` },
				{ path: `/fields/${B}` },
			],
			{ tables: [B, A] },
		);
	});

	it('deleting the m2o field removes the relation and the o2m field; DELETE /relations drops the foreign key', async () => {
		await ddlScenario(
			db,
			[
				collection(B),
				collection(A, [
					{ field: 'b', type: 'integer', meta: { special: ['m2o'] } },
					{ field: 'b2', type: 'integer', meta: { special: ['m2o'] } },
				]),
				addField(B, { field: 'as', type: 'alias', meta: { special: ['o2m'] } }),
				relation({ collection: A, field: 'b', related_collection: B, meta: { one_field: 'as' } }),
				relation({ collection: A, field: 'b2', related_collection: B }),
				{ method: 'DELETE', path: `/fields/${A}/b` },
				{ path: `/fields/${B}` },
				{ method: 'DELETE', path: `/relations/${A}/b2` },
				{ method: 'DELETE', path: `/relations/${A}/b2` },
				{ path: `/relations/${A}` },
			],
			{ tables: [B, A] },
		);
	});

	it('errors: primary key, a field that already has a relation, unknown collections, Joi, foreign key on rows with no match', async () => {
		await ddlScenario(
			db,
			[
				collection(B),
				collection(A, [
					{ field: 'b', type: 'integer', meta: { special: ['m2o'] } },
					{ field: 'code', type: 'string', meta: {} },
					{ field: 'orphan', type: 'integer', meta: {} },
				]),
				relation({ collection: A, field: 'id', related_collection: B }),
				relation({ collection: A, field: 'b', related_collection: 'nope' }),
				relation({ collection: 'nope', field: 'b', related_collection: B }),
				relation({ collection: A, field: 'nope', related_collection: B }),
				relation({ collection: A }),
				relation({ collection: A, field: 'b', related_collection: B, schema: { on_delete: 'NOPE' } }),
				relation({ collection: A, field: 'b', related_collection: B }),
				relation({ collection: A, field: 'b', related_collection: B }),
				relation({ collection: A, field: 'code', related_collection: B }),
				{ method: 'POST', path: `/items/${A}`, body: { orphan: 999 } },
				relation({ collection: A, field: 'orphan', related_collection: B }),
				{ method: 'PATCH', path: `/relations/${A}/code`, body: { meta: {} } },
				{ method: 'DELETE', path: `/relations/${A}/code` },
				{ method: 'DELETE', path: `/relations/nope/b` },
			],
			{ tables: [B, A] },
		);
	});
});

describe('m2m, m2a, translations, files (FR-021, FR-030)', () => {
	it('m2m through a junction like the Directus app', async () => {
		const J = `${A}_${B}`;

		await ddlScenario(
			db,
			[
				collection(A),
				collection(B),
				addField(A, { field: 'bs', type: 'alias', meta: { special: ['m2m'], interface: 'list-m2m' } }),
				collection(J, [
					{ field: `${A}_id`, type: 'integer', meta: { hidden: true } },
					{ field: `${B}_id`, type: 'integer', meta: { hidden: true } },
				]),
				relation({
					collection: J,
					field: `${B}_id`,
					related_collection: B,
					meta: { one_field: null, junction_field: `${A}_id` },
					schema: { on_delete: 'SET NULL' },
				}),
				relation({
					collection: J,
					field: `${A}_id`,
					related_collection: A,
					meta: { one_field: 'bs', junction_field: `${B}_id`, sort_field: null },
					schema: { on_delete: 'SET NULL' },
				}),
				{ method: 'POST', path: `/items/${A}`, body: { bs: [{ [`${B}_id`]: { id: 1 } }] } },
				{ path: `/items/${A}?fields=bs.${B}_id.id` },
				{ path: `/relations/${J}` },
				{ method: 'DELETE', path: `/collections/${B}` },
				{ path: `/relations/${J}` },
			],
			{ tables: [A, B, J] },
		);
	});

	it('m2a: no foreign key on the "any" side; deleting an allowed collection strips one_allowed_collections', async () => {
		const J = `${A}_builder`;

		await ddlScenario(
			db,
			[
				collection(A),
				collection(B, [{ field: 'title', type: 'string', meta: {} }]),
				collection(C, [{ field: 'title', type: 'string', meta: {} }]),
				addField(A, { field: 'blocks', type: 'alias', meta: { special: ['m2a'], interface: 'list-m2a' } }),
				collection(J, [
					{ field: `${A}_id`, type: 'integer', meta: { hidden: true } },
					{ field: 'item', type: 'string', meta: { hidden: true } },
					{ field: 'collection', type: 'string', meta: { hidden: true } },
				]),
				relation({
					collection: J,
					field: 'item',
					related_collection: null,
					meta: { one_allowed_collections: [B, C], one_collection_field: 'collection', junction_field: `${A}_id` },
				}),
				relation({
					collection: J,
					field: `${A}_id`,
					related_collection: A,
					meta: { one_field: 'blocks', junction_field: 'item' },
					schema: { on_delete: 'SET NULL' },
				}),
				{ path: `/relations/${J}/item` },
				{ method: 'PATCH', path: `/relations/${J}/item`, body: { meta: { one_allowed_collections: [C, B] } } },
				{ method: 'DELETE', path: `/collections/${C}` },
				{ path: `/relations/${J}` },
			],
			{ tables: [A, B, C, J] },
		);
	});

	it('translations: languages, a translations junction and the alias field of the translations interface', async () => {
		const L = `${P}_languages`;
		const T = `${A}_translations`;

		await ddlScenario(
			db,
			[
				{
					method: 'POST',
					path: '/collections',
					body: {
						collection: L,
						schema: {},
						meta: { icon: 'translate' },
						fields: [
							{ field: 'code', type: 'string', meta: { interface: 'input' }, schema: { is_primary_key: true } },
							{ field: 'name', type: 'string', meta: {} },
						],
					},
				},
				{
					method: 'POST',
					path: `/items/${L}`,
					body: [
						{ code: 'en-US', name: 'English' },
						{ code: 'vi-VN', name: 'Vietnamese' },
					],
				},
				collection(A),
				addField(A, {
					field: 'translations',
					type: 'alias',
					meta: { special: ['translations'], interface: 'translations' },
				}),
				collection(T, [
					{ field: `${A}_id`, type: 'integer', meta: { hidden: true } },
					{ field: `${L}_code`, type: 'string', meta: { hidden: true } },
					{ field: 'title', type: 'string', meta: {} },
				]),
				relation({
					collection: T,
					field: `${L}_code`,
					related_collection: L,
					meta: { junction_field: `${A}_id` },
					schema: { on_delete: 'SET NULL' },
				}),
				relation({
					collection: T,
					field: `${A}_id`,
					related_collection: A,
					meta: { one_field: 'translations', junction_field: `${L}_code` },
					schema: { on_delete: 'SET NULL' },
				}),
				{
					method: 'POST',
					path: `/items/${A}`,
					body: { translations: [{ [`${L}_code`]: 'vi-VN', title: 'Xin chào' }] },
				},
				{ path: `/items/${A}?fields=translations.title,translations.${L}_code` },
			],
			{ tables: [L, A, T] },
		);
	});

	it('files: m2o to directus_files; a user field of directus_users pointing at a user collection', async () => {
		const removeUserField = async (app: 'directus' | 'backoffice') => {
			await appRequest(app, 'DELETE', `/fields/directus_users/${P}_team`).catch(() => undefined);
		};

		await ddlScenario(
			db,
			[
				collection(A, [{ field: 'image', type: 'uuid', meta: { special: ['file'], interface: 'file-image' } }]),
				relation({
					collection: A,
					field: 'image',
					related_collection: 'directus_files',
					schema: { on_delete: 'SET NULL' },
				}),
				{ path: `/relations/${A}/image` },
				addField('directus_users', { field: `${P}_team`, type: 'integer', meta: { special: ['m2o'] } }),
				relation({ collection: 'directus_users', field: `${P}_team`, related_collection: A }),
				{ path: `/relations/directus_users/${P}_team` },
				{ method: 'DELETE', path: `/fields/directus_users/${P}_team` },
			],
			{ tables: [A, 'directus_users'], cleanup: removeUserField },
		);
	});
});

describe('presentation and group fields (FR-021)', () => {
	it('a divider, a group with children; deleting the group frees its children', async () => {
		await ddlScenario(
			db,
			[
				collection(A, [{ field: 'title', type: 'string', meta: {} }]),
				addField(A, {
					field: 'divider',
					type: 'alias',
					meta: { special: ['alias', 'no-data'], interface: 'presentation-divider' },
				}),
				addField(A, {
					field: 'details',
					type: 'alias',
					meta: { special: ['alias', 'no-data', 'group'], interface: 'group-detail' },
				}),
				addField(A, { field: 'summary', type: 'text', meta: { group: 'details' } }),
				addField(A, { field: 'notes', type: 'text', meta: { group: 'details' } }),
				{ method: 'PATCH', path: `/fields/${A}`, body: [{ field: 'title', meta: { group: 'details', sort: 3 } }] },
				{ path: `/fields/${A}` },
				{ method: 'DELETE', path: `/fields/${A}/details` },
				{ path: `/fields/${A}` },
			],
			{ tables: [A] },
		);
	});
});
