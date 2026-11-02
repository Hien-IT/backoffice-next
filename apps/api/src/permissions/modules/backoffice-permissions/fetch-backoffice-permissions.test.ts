// Backoffice (spec 025): rows of backoffice_permissions on SQLite in memory (strings for JSON) and as Postgres returns
// them (objects), cached in the permissions cache.
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { up } from '../../../database/backoffice-migrations/20261028A-create-backoffice-permissions.js';
import { clearCache } from '../../cache.js';
import {
	_fetchBackofficePermissions,
	fetchBackofficePermissions,
	fetchPoliciesWithRows,
	toPermission,
} from './fetch-backoffice-permissions.js';

let db: Knex;

beforeEach(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
	await up(db);
	await clearCache();

	await db
		.insert([
			{
				policy: 'p2',
				collection: 'articles',
				action: 'export',
				permissions: '{"status":{"_eq":"published"}}',
				fields: 'id,title',
				options: '{"formats":["csv"]}',
			},
			{ policy: 'p1', collection: 'articles', action: 'export', permissions: null, fields: null, options: null },
			{ policy: 'p1', collection: 'articles', action: 'import' },
			{ policy: 'p1', collection: 'pages', action: 'export' },
			{ policy: 'p3', collection: 'articles', action: 'export' },
		])
		.into('backoffice_permissions');
});

afterEach(async () => {
	await db.destroy();
});

test('rows of the policies for a collection and action, in the order of the policies; JSON and csv parsed', async () => {
	const rows = await _fetchBackofficePermissions(
		{ policies: ['p1', 'p2'], collection: 'articles', action: 'export' },
		{ knex: db },
	);

	expect(rows).toEqual([
		expect.objectContaining({ policy: 'p1', permissions: null, fields: null, options: null }),
		expect.objectContaining({
			policy: 'p2',
			collection: 'articles',
			action: 'export',
			permissions: { status: { _eq: 'published' } },
			fields: ['id', 'title'],
			options: { formats: ['csv'] },
		}),
	]);
});

test('without collection and action: every row of the policies', async () => {
	const rows = await _fetchBackofficePermissions({ policies: ['p1'] }, { knex: db });
	expect(rows.map((r) => `${r.collection}:${r.action}`).sort()).toEqual([
		'articles:export',
		'articles:import',
		'pages:export',
	]);
});

test('no policies: no query', async () => {
	const select = vi.spyOn(db, 'select');
	expect(await _fetchBackofficePermissions({ policies: [] }, { knex: db })).toEqual([]);
	expect(select).not.toHaveBeenCalled();
});

test('JSON columns already parsed (Postgres) are kept', () => {
	expect(
		toPermission({
			id: 1,
			policy: 'p',
			collection: 'a',
			action: 'export',
			permissions: { id: { _gt: 1 } },
			options: { formats: ['json'] },
		}),
	).toMatchObject({
		permissions: { id: { _gt: 1 } },
		options: { formats: ['json'] },
		fields: null,
	});
});

test('cached: a second call does not query until the permissions cache is cleared', async () => {
	const options = { policies: ['p1'], collection: 'pages', action: 'export' };
	expect(await fetchBackofficePermissions(options, { knex: db } as never)).toHaveLength(1);

	await db('backoffice_permissions').where({ collection: 'pages' }).delete();
	expect(await fetchBackofficePermissions(options, { knex: db } as never)).toHaveLength(1);

	await clearCache();
	expect(await fetchBackofficePermissions(options, { knex: db } as never)).toHaveLength(0);
});

test('policies without rows: no query per policy list, only the cached list of policies with rows', async () => {
	expect(await fetchPoliciesWithRows({ knex: db })).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));

	const select = vi.spyOn(db, 'select');
	expect(await fetchBackofficePermissions({ policies: ['p9', 'p8'] }, { knex: db })).toEqual([]);
	expect(select).not.toHaveBeenCalled();
});

test('a mixed policy list asks for its policies with rows only, in the given order', async () => {
	const rows = await fetchBackofficePermissions({ policies: ['p9', 'p2', 'p1'], action: 'export' }, { knex: db });
	expect(rows.map((r) => `${r.policy}:${r.collection}`)).toEqual(['p2:articles', 'p1:articles', 'p1:pages']);
});

test('a policy that gets its first row is seen once the permissions cache is cleared', async () => {
	expect(await fetchBackofficePermissions({ policies: ['p9'] }, { knex: db })).toEqual([]);

	await db.insert({ policy: 'p9', collection: 'articles', action: 'export' }).into('backoffice_permissions');
	expect(await fetchBackofficePermissions({ policies: ['p9'] }, { knex: db })).toEqual([]);

	await clearCache();
	expect(await fetchBackofficePermissions({ policies: ['p9'] }, { knex: db })).toHaveLength(1);
});
