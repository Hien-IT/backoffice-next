// Backoffice (spec 032, contracts/tests.md §1): readState reads each group from its table with the real columns only,
// leaves the encrypted ones out, nests operations and panels, and names bundle entries after their bundle.
import type { SchemaOverview } from '@backoffice/types';
import { afterEach, expect, test, vi } from 'vitest';
import { ExtensionsService } from '../services/extensions.service.js';
import { ItemsService } from '../services/items.service.js';
import { columnsOf, hiddenSettingsFields, readState } from './state.js';

vi.mock('../services/items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

vi.mock('../services/extensions.service.js', () => ({
	ExtensionsService: vi.fn(function () {
		return { readAll: vi.fn() };
	}),
}));

vi.mock('../utils/get-snapshot.js', () => ({
	getSnapshot: vi.fn(async () => ({
		version: 1,
		directus: '11.17.4',
		vendor: 'sqlite',
		collections: [],
		fields: [],
		systemFields: [{ collection: 'directus_users', field: 'email', schema: { is_indexed: true } }],
		relations: [],
	})),
}));

const f = (field: string, type = 'string', special: string[] = []) => ({ field, type, special });

const table = (name: string, fields: ReturnType<typeof f>[]) => ({
	collection: name,
	primary: 'id',
	fields: Object.fromEntries(fields.map((x) => [x.field, x])),
});

const schema = {
	collections: {
		directus_flows: table('directus_flows', [f('id'), f('name'), f('operations', 'alias', ['o2m'])]),
		directus_operations: table('directus_operations', [f('id'), f('flow'), f('key')]),
		directus_presets: table('directus_presets', [
			f('id', 'integer'),
			f('collection'),
			f('bookmark'),
			f('user'),
			f('role'),
		]),
		directus_settings: table('directus_settings', [
			f('id'),
			f('project_name'),
			f('ai_openai_api_key', 'string', ['encrypt']),
		]),
	},
	relations: [],
} as unknown as SchemaOverview;

const ctx = { knex: {} as never, schema, accountability: { admin: true } as never };

afterEach(() => vi.clearAllMocks());

test('columnsOf drops alias and encrypted columns; hiddenSettingsFields lists the encrypted ones', () => {
	expect(columnsOf(schema, 'directus_flows')).toEqual(['id', 'name']);
	expect(columnsOf(schema, 'directus_settings')).toEqual(['id', 'project_name']);
	expect(columnsOf(schema, 'missing')).toEqual([]);
	expect(hiddenSettingsFields(schema)).toEqual(['ai_openai_api_key']);
});

test('flows nest their operations; presets read only the global ones; a missing table gives no rows', async () => {
	vi.mocked(ItemsService.prototype.readByQuery).mockImplementation(async function (this: ItemsService) {
		if (this.collection === 'directus_flows') return [{ id: 'f1', name: 'A' }];
		if (this.collection === 'directus_operations')
			return [
				{ id: 'o1', flow: 'f1' },
				{ id: 'o2', flow: 'f9' },
			];
		return [{ id: 1, collection: 'articles', bookmark: null }];
	});

	const state = await readState(['flows', 'presets', 'folders'], ctx);

	expect(state.flows).toEqual([{ id: 'f1', name: 'A', operations: [{ id: 'o1', flow: 'f1' }] }]);
	expect(state.presets).toHaveLength(1);
	expect(state.folders).toEqual([]);

	const presetQuery = vi
		.mocked(ItemsService.prototype.readByQuery)
		.mock.calls.find((_, i) => vi.mocked(ItemsService).mock.instances[i]?.collection === 'directus_presets')?.[0];

	expect(presetQuery).toMatchObject({
		fields: ['id', 'collection', 'bookmark', 'user', 'role'],
		limit: -1,
		filter: { _and: [{ user: { _null: true } }, { role: { _null: true } }] },
	});
});

test('settings without the encrypted fields; schema without systemFields; extensions named after their bundle', async () => {
	vi.mocked(ItemsService.prototype.readByQuery).mockResolvedValue([{ id: 1, project_name: 'Stg' }]);
	vi.mocked(ExtensionsService).mockImplementation(function () {
		return {
			readAll: vi.fn(async () => [
				{ id: 'b1', bundle: null, meta: { enabled: true, folder: 'x' }, schema: { name: 'tools' } },
				{ id: 'e1', bundle: 'b1', meta: { enabled: false, folder: 'hook' }, schema: { name: 'hook' } },
			]),
		} as never;
	});

	const state = await readState(['settings', 'schema', 'extensions'], ctx);

	expect(vi.mocked(ItemsService.prototype.readByQuery).mock.calls[0]![0]).toMatchObject({
		fields: ['id', 'project_name'],
	});
	expect(state.settings).toEqual({ id: 1, project_name: 'Stg' });
	expect(state.schema).not.toHaveProperty('systemFields');
	expect(state.extensions).toEqual([
		{ id: 'b1', name: 'tools', bundle: null, enabled: true },
		{ id: 'e1', name: 'tools/hook', bundle: 'tools', enabled: false },
	]);
});
