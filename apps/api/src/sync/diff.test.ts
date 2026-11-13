// Backoffice (spec 032, contracts/tests.md §1): rows, states, dependencies, cascades and the hash of a comparison.
import type { SchemaOverview, Snapshot } from '@backoffice/types';
import { describe, expect, test } from 'vitest';
import { diffStates, hashStates, stable } from './diff.js';
import type { SyncRow, SyncState } from './types.js';

const field = (name: string, special: string[] = [], type = 'string') => ({
	field: name,
	type,
	special,
	alias: false,
	nullable: true,
	defaultValue: null,
	dbType: null,
	precision: null,
	scale: null,
	generated: false,
	note: null,
	searchable: true,
	validation: null,
});

const schema = {
	collections: {
		articles: { collection: 'articles', primary: 'id', fields: { id: field('id') } },
		directus_settings: {
			collection: 'directus_settings',
			primary: 'id',
			fields: {
				id: field('id'),
				project_name: field('project_name'),
				project_logo: field('project_logo'),
				storage_default_folder: field('storage_default_folder'),
				ai_openai_api_key: field('ai_openai_api_key', ['encrypt']),
			},
		},
	},
	relations: [
		{ collection: 'directus_settings', field: 'project_logo', related_collection: 'directus_files' },
		{ collection: 'directus_settings', field: 'storage_default_folder', related_collection: 'directus_folders' },
	],
} as unknown as SchemaOverview;

const ctx = { schema, targetRefs: { files: new Set<string>(), folders: new Set<string>(), roles: new Set<string>() } };
const find = (rows: SyncRow[], id: string) => rows.find((r) => r.id === id)!;

const access = (over: Partial<NonNullable<SyncState['access']>> = {}): NonNullable<SyncState['access']> => ({
	roles: [],
	policies: [],
	links: [],
	permissions: [],
	bo_permissions: [],
	...over,
});

describe('table groups', () => {
	test('four states for flows matched by id; operations compared inside the flow; ignored columns left out', () => {
		const source: SyncState = {
			flows: [
				{ id: 'f1', name: 'Same', status: 'active', date_created: 'a', operations: [] },
				{ id: 'f2', name: 'Changed', status: 'active', operations: [{ id: 'o1', key: 'log', options: { a: 1 } }] },
				{ id: 'f3', name: 'New', status: 'active', operations: [] },
			],
		};

		const target: SyncState = {
			flows: [
				{ id: 'f1', name: 'Same', status: 'active', date_created: 'b', operations: [] },
				{ id: 'f2', name: 'Changed', status: 'inactive', operations: [{ id: 'o2', key: 'old' }] },
				{ id: 'f4', name: 'Only target', status: 'active', operations: [] },
			],
		};

		const rows = diffStates(source, target, ['flows'], ctx);

		// Sorted by label within the group.
		expect(rows.map((r) => [r.id, r.state])).toEqual([
			['flows/flow:f2', 'changed'],
			['flows/flow:f3', 'source_only'],
			['flows/flow:f4', 'target_only'],
			['flows/flow:f1', 'same'],
		]);

		const changed = find(rows, 'flows/flow:f2');
		expect(changed.changes!.map((c) => c.path).sort()).toEqual(['operations.o1', 'operations.o2', 'status']);
		expect(find(rows, 'flows/flow:f3').impact).toEqual({ active: true });
		expect(find(rows, 'flows/flow:f1').selectable).toBe(false);
	});

	test('permissions match on policy, collection, action whatever their ids; a duplicate key cannot be ticked', () => {
		const source: SyncState = {
			access: access({
				policies: [{ id: 'p1', name: 'Editor', admin_access: false }],
				permissions: [
					{ id: 1, policy: 'p1', collection: 'articles', action: 'read', fields: ['*'] },
					{ id: 2, policy: 'p1', collection: 'articles', action: 'read', fields: ['id'] },
				],
			}),
		};

		const target: SyncState = {
			access: access({
				policies: [{ id: 'p1', name: 'Editor', admin_access: false }],
				permissions: [{ id: 99, policy: 'p1', collection: 'articles', action: 'read', fields: ['*'] }],
			}),
		};

		const rows = diffStates(source, target, ['access'], ctx);
		expect(find(rows, 'access/permission:p1:articles:read')).toMatchObject({
			state: 'same',
			label: 'Editor · articles · read',
		});
		expect(rows.find((r) => r.id.startsWith('access/permission:p1:articles:read#'))).toMatchObject({
			selectable: false,
			reason: 'sync_duplicate_key',
		});
	});

	test('depends: a new permission needs its new policy; a link needs role and policy; same rows are dropped', () => {
		const source: SyncState = {
			access: access({
				roles: [{ id: 'r1', name: 'Writers', parent: null }],
				policies: [{ id: 'p2', name: 'Writer', admin_access: false }],
				links: [{ id: 'l1', role: 'r1', policy: 'p2' }],
				permissions: [{ id: 5, policy: 'p2', collection: 'articles', action: 'create' }],
			}),
		};

		const target: SyncState = { access: access({ roles: [{ id: 'r1', name: 'Writers', parent: null }] }) };
		const rows = diffStates(source, target, ['access'], ctx);

		expect(find(rows, 'access/permission:p2:articles:create').depends).toEqual(['access/policy:p2']);
		expect(find(rows, 'access/link:l1').depends).toEqual(['access/policy:p2']);
	});

	test('a permission on a collection the target does not have is blocked when the data model is not compared', () => {
		const source: SyncState = {
			access: access({
				policies: [{ id: 'p1', name: 'Editor' }],
				permissions: [{ id: 1, policy: 'p1', collection: 'missing', action: 'read' }],
			}),
		};

		const rows = diffStates(source, { access: access({ policies: [{ id: 'p1', name: 'Editor' }] }) }, ['access'], ctx);
		expect(find(rows, 'access/permission:p1:missing:read')).toMatchObject({
			selectable: false,
			reason: 'sync_needs_row',
		});
	});

	test('deletes: an admin policy or role cannot be ticked; a deleted policy takes its permissions and links (cascade)', () => {
		const target: SyncState = {
			access: access({
				roles: [
					{ id: 'admin-role', name: 'Administrator' },
					{ id: 'r2', name: 'Old' },
				],
				policies: [
					{ id: 'admin-policy', name: 'Admin', admin_access: true },
					{ id: 'p3', name: 'Old policy', admin_access: false },
				],
				links: [
					{ id: 'l-admin', role: 'admin-role', policy: 'admin-policy' },
					{ id: 'l-old', role: 'r2', policy: 'p3' },
				],
				permissions: [{ id: 9, policy: 'p3', collection: 'articles', action: 'read' }],
			}),
		};

		const rows = diffStates({ access: access() }, target, ['access'], ctx);

		expect(find(rows, 'access/policy:admin-policy')).toMatchObject({
			selectable: false,
			reason: 'sync_admin_protected',
		});
		expect(find(rows, 'access/role:admin-role')).toMatchObject({ selectable: false, reason: 'sync_admin_protected' });
		expect(find(rows, 'access/policy:p3').cascade.sort()).toEqual([
			'access/link:l-old',
			'access/permission:p3:articles:read',
		]);
		expect(find(rows, 'access/role:r2')).toMatchObject({ selectable: true, cascade: ['access/link:l-old'] });
	});

	test('a deleted folder takes its target_only children; a child kept under another parent must move first', () => {
		const source: SyncState = { folders: [{ id: 'c2', name: 'Kept', parent: null }] };
		const target: SyncState = {
			folders: [
				{ id: 'p', name: 'Parent', parent: null },
				{ id: 'c1', name: 'Child', parent: 'p' },
				{ id: 'g1', name: 'Grandchild', parent: 'c1' },
				{ id: 'c2', name: 'Kept', parent: 'p' },
			],
		};

		const parent = find(diffStates(source, target, ['folders'], ctx), 'folders/folder:p');
		expect(parent.cascade.sort()).toEqual(['folders/folder:c1', 'folders/folder:g1']);
		expect(parent.depends).toEqual(['folders/folder:c2']);
	});
});

describe('settings, extensions, data model', () => {
	test('settings compare per field; a missing file blocks; encrypted fields are listed but never compared', () => {
		const rows = diffStates(
			{ settings: { id: 1, project_name: 'Stg', project_logo: 'file-1', storage_default_folder: 'folder-1' } },
			{ settings: { id: 1, project_name: 'Prod', project_logo: null, storage_default_folder: null } },
			['settings'],
			ctx,
		);

		expect(find(rows, 'settings/field:project_name')).toMatchObject({ state: 'changed', selectable: true });
		expect(find(rows, 'settings/field:project_logo')).toMatchObject({ selectable: false, reason: 'sync_file_missing' });
		expect(find(rows, 'settings/field:storage_default_folder')).toMatchObject({
			selectable: false,
			reason: 'sync_needs_row',
		});
		expect(find(rows, 'settings/field:ai_openai_api_key')).toMatchObject({
			selectable: false,
			reason: 'sync_value_hidden',
		});
		expect(rows.find((r) => r.id === 'settings/field:id')).toBeUndefined();
	});

	test('extensions: only `enabled` is compared; an extension on one side cannot be ticked', () => {
		const rows = diffStates(
			{
				extensions: [
					{ id: 's1', name: 'a', bundle: null, enabled: true },
					{ name: 'b', bundle: null, enabled: true },
				],
			},
			{ extensions: [{ id: 't1', name: 'a', bundle: null, enabled: false }] },
			['extensions'],
			ctx,
		);

		expect(find(rows, 'extensions/extension:a')).toMatchObject({ state: 'changed', selectable: true });
		expect(find(rows, 'extensions/extension:b')).toMatchObject({ selectable: false, reason: 'sync_extension_missing' });
	});

	test('a new collection carries its new fields; a field of an existing collection is its own row', () => {
		const snapshot = (collections: string[], fields: [string, string][]): Snapshot =>
			({
				version: 1,
				directus: '11.17.4',
				vendor: 'postgres',
				collections: collections.map((c) => ({
					collection: c,
					meta: { collection: c, group: null },
					schema: { name: c },
				})),
				fields: fields.map(([c, f]) => ({
					collection: c,
					field: f,
					type: 'string',
					meta: { collection: c, field: f },
					schema: { name: f, table: c },
				})),
				relations: [],
			}) as unknown as Snapshot;

		const rows = diffStates(
			{
				schema: snapshot(
					['articles', 'tags'],
					[
						['articles', 'id'],
						['articles', 'title'],
						['tags', 'id'],
					],
				),
			},
			{ schema: snapshot(['articles'], [['articles', 'id']]) },
			['schema'],
			ctx,
		);

		expect(find(rows, 'schema/collection:tags')).toMatchObject({ state: 'source_only' });
		expect((find(rows, 'schema/collection:tags').source!['fields'] as unknown[]).length).toBe(1);
		expect(find(rows, 'schema/field:articles.title')).toMatchObject({ state: 'source_only', depends: [] });
		expect(rows.find((r) => r.id === 'schema/field:tags.id')).toBeUndefined();
	});
});

test('hash: ignored values and extension ids do not change it; a compared value does', () => {
	const a: SyncState = {
		flows: [{ id: 'f1', name: 'A', date_created: 'x', operations: [] }],
		extensions: [{ id: '1', name: 'e', bundle: null, enabled: true }],
	};
	const b: SyncState = {
		flows: [{ id: 'f1', name: 'A', date_created: 'y', operations: [] }],
		extensions: [{ id: '2', name: 'e', bundle: null, enabled: true }],
	};
	const c: SyncState = { flows: [{ id: 'f1', name: 'B', operations: [] }], extensions: [] };

	expect(hashStates(a, a, ['flows', 'extensions'])).toBe(hashStates(b, b, ['flows', 'extensions']));
	expect(hashStates(a, a, ['flows'])).not.toBe(hashStates(c, a, ['flows']));
	expect(stable({ b: 1, a: [2, { d: 1, c: 0 }] })).toBe('{"a":[2,{"c":0,"d":1}],"b":1}');
});
