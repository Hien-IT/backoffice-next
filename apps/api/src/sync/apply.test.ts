// Backoffice (spec 032, contracts/tests.md §1): the order of the writes, the flow FK cycle, rows already deleted by a
// cascade, the caller's admin check and the steps after the commit. The services are fakes that record their calls.
import { InvalidPayloadError } from '@backoffice/errors';
import type { Snapshot } from '@backoffice/types';
import { fetchGlobalAccessForRoles, fetchGlobalAccessForUser } from '@backoffice/utils/node';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { afterCommit, assertCallerAdmin, selectSchemaDiff, writeRows } from './apply.js';
import type { SyncRow } from './types.js';

const log = vi.hoisted(() => ({ calls: [] as string[], fail: undefined as string | undefined }));

vi.mock('../services/index.js', () => ({}));

const fake = vi.hoisted(
	() => (name: string) =>
		vi.fn(function (this: Record<string, unknown>, collection?: unknown) {
			const label = typeof collection === 'string' ? collection : name;
			const record = (method: string) =>
				vi.fn(async (...args: unknown[]) => {
					const call = `${label}.${method}(${JSON.stringify(args)})`;
					log.calls.push(call);
					if (log.fail && call.includes(log.fail)) throw new InvalidPayloadError({ reason: 'boom' });
					return method === 'create' ? { status: 'creating' } : 'ok';
				});

			for (const method of [
				'createOne',
				'updateOne',
				'updateMany',
				'deleteOne',
				'deleteMany',
				'upsertSingleton',
				'create',
				'remove',
			]) {
				this[method] = record(method);
			}
		}),
);

vi.mock('../services/items.service.js', () => ({ ItemsService: fake('items') }));
vi.mock('../services/folders.service.js', () => ({ FoldersService: fake('folders') }));
vi.mock('../services/roles.service.js', () => ({ RolesService: fake('roles') }));
vi.mock('../services/policies.service.js', () => ({ PoliciesService: fake('policies') }));
vi.mock('../services/access.service.js', () => ({ AccessService: fake('access') }));
vi.mock('../services/permissions.service.js', () => ({ PermissionsService: fake('permissions') }));
vi.mock('../services/backoffice-permissions.service.js', () => ({
	BackofficePermissionsService: fake('bo_permissions'),
}));
vi.mock('../services/translations.service.js', () => ({ TranslationsService: fake('translations') }));
vi.mock('../services/presets.service.js', () => ({ PresetsService: fake('presets') }));
vi.mock('../services/dashboards.service.js', () => ({ DashboardsService: fake('dashboards') }));
vi.mock('../services/panels.service.js', () => ({ PanelsService: fake('panels') }));
vi.mock('../services/extensions.service.js', () => ({ ExtensionsService: fake('extensions') }));
vi.mock('../services/backoffice-indexes.service.js', () => ({ BackofficeIndexesService: fake('indexes') }));

const managers = vi.hoisted(() => ({
	flows: vi.fn(),
	extReload: vi.fn(),
	extBroadcast: vi.fn(),
	cache: vi.fn(),
	perms: vi.fn(),
}));
vi.mock('../flows.js', () => ({ getFlowManager: () => ({ reload: managers.flows }) }));
vi.mock('../extensions/index.js', () => ({
	getExtensionManager: () => ({ reload: managers.extReload, broadcastReloadNotification: managers.extBroadcast }),
}));
vi.mock('../cache.js', () => ({ flushCaches: managers.cache }));
vi.mock('../permissions/cache.js', () => ({ clearCache: managers.perms }));
vi.mock('../permissions/lib/fetch-roles-tree.js', () => ({ fetchRolesTree: vi.fn(async () => ['r1']) }));
vi.mock('@backoffice/utils/node', async (importOriginal) => ({
	...(await importOriginal<typeof import('@backoffice/utils/node')>()),
	fetchGlobalAccessForRoles: vi.fn(),
	fetchGlobalAccessForUser: vi.fn(),
}));

/** A knex stand-in: `select().from(t).where('id', x).first()` finds the rows listed in `present`. */
const present = new Set<string>();
const knex = {
	select: () => {
		let table = '';
		let id = '';
		const q = {
			from: (t: string) => ((table = t), q),
			where: (_c: string, v: string) => ((id = v), q),
			first: async () => (present.has(`${table}:${id}`) || table === 'directus_users' ? { id, role: 'r1' } : undefined),
		};

		return q;
	},
} as never;

const ctx = {
	knex,
	schema: { collections: {}, relations: [] } as never,
	accountability: { user: 'u1', admin: true } as never,
};

const row = (over: Partial<SyncRow>): SyncRow =>
	({ depends: [], cascade: [], selectable: true, label: over.key ?? 'x', ...over }) as SyncRow;

beforeEach(() => {
	log.calls = [];
	log.fail = undefined;
	present.clear();
});

afterEach(() => vi.clearAllMocks());

describe('writeRows', () => {
	test('deletes run first in reverse order (children first), then creates by dependency (parents first)', async () => {
		present.add('directus_folders:old-parent').add('directus_folders:old-child').add('directus_policies:p-old');

		await writeRows(
			[
				row({
					id: 'access/policy:p-new',
					group: 'access',
					kind: 'policy',
					key: 'p-new',
					state: 'source_only',
					source: { id: 'p-new', name: 'P' },
				}),
				row({
					id: 'folders/folder:child',
					group: 'folders',
					kind: 'folder',
					key: 'child',
					state: 'source_only',
					source: { id: 'child', parent: 'root' },
				}),
				row({
					id: 'folders/folder:root',
					group: 'folders',
					kind: 'folder',
					key: 'root',
					state: 'source_only',
					source: { id: 'root', parent: null },
				}),
				row({
					id: 'folders/folder:old-parent',
					group: 'folders',
					kind: 'folder',
					key: 'old-parent',
					state: 'target_only',
					target: { id: 'old-parent', parent: null },
				}),
				row({
					id: 'folders/folder:old-child',
					group: 'folders',
					kind: 'folder',
					key: 'old-child',
					state: 'target_only',
					target: { id: 'old-child', parent: 'old-parent' },
				}),
				row({
					id: 'access/policy:p-old',
					group: 'access',
					kind: 'policy',
					key: 'p-old',
					state: 'target_only',
					target: { id: 'p-old' },
				}),
			],
			ctx,
		);

		expect(log.calls).toHaveLength(6);
		const short = log.calls.map((c) => c.replace(/\(.*/, ''));
		expect(short).toEqual([
			'policies.deleteOne',
			'folders.deleteOne',
			'folders.deleteOne',
			'folders.createOne',
			'folders.createOne',
			'policies.createOne',
		]);

		expect(log.calls[1]).toContain('old-child');
		expect(log.calls[2]).toContain('old-parent');
		expect(log.calls[3]).toContain('"root"');
		expect(log.calls[4]).toContain('"child"');
	});

	test('a new flow: flow without entry operation, operations without links, then the links, then the entry', async () => {
		await writeRows(
			[
				row({
					id: 'flows/flow:f1',
					group: 'flows',
					kind: 'flow',
					key: 'f1',
					state: 'source_only',
					source: {
						id: 'f1',
						name: 'F',
						status: 'active',
						operation: 'o1',
						operations: [
							{ id: 'o1', key: 'a', resolve: 'o2', reject: null },
							{ id: 'o2', key: 'b', resolve: null, reject: null },
						],
					},
				}),
			],
			ctx,
		);

		expect(log.calls).toEqual([
			'directus_flows.createOne([{"id":"f1","name":"F","status":"active","operation":null}])',
			'directus_operations.createOne([{"id":"o1","key":"a","flow":"f1","resolve":null,"reject":null}])',
			'directus_operations.createOne([{"id":"o2","key":"b","flow":"f1","resolve":null,"reject":null}])',
			'directus_operations.updateOne(["o1",{"resolve":"o2"}])',
			'directus_flows.updateOne(["f1",{"operation":"o1"}])',
		]);
	});

	test('a changed flow frees the links, deletes the target-only operations, creates and updates the others', async () => {
		await writeRows(
			[
				row({
					id: 'flows/flow:f1',
					group: 'flows',
					kind: 'flow',
					key: 'f1',
					state: 'changed',
					source: {
						id: 'f1',
						name: 'New',
						operation: null,
						operations: [
							{ id: 'o1', key: 'a', resolve: null, reject: null },
							{ id: 'o3', key: 'c', resolve: null, reject: null },
						],
					},
					target: {
						id: 'f1',
						name: 'Old',
						operation: 'o2',
						operations: [
							{ id: 'o1', key: 'x' },
							{ id: 'o2', key: 'y' },
						],
					},
				}),
			],
			ctx,
		);

		expect(log.calls).toEqual([
			'directus_flows.updateOne(["f1",{"name":"New","operation":null}])',
			'directus_operations.updateMany([["o1","o2"],{"resolve":null,"reject":null}])',
			'directus_operations.deleteMany([["o2"]])',
			'directus_operations.updateOne(["o1",{"key":"a","flow":"f1"}])',
			'directus_operations.createOne([{"id":"o3","key":"c","flow":"f1","resolve":null,"reject":null}])',
		]);
	});

	test('natural keys: created without an id, updated by the target id; a row already gone is skipped', async () => {
		const counts = await writeRows(
			[
				row({
					id: 'access/permission:p:a:read',
					group: 'access',
					kind: 'permission',
					key: 'p:a:read',
					state: 'source_only',
					source: { policy: 'p', collection: 'a', action: 'read' },
				}),
				row({
					id: 'translations/translation:en:k',
					group: 'translations',
					kind: 'translation',
					key: 'en:k',
					state: 'changed',
					source: { language: 'en', key: 'k', value: 'v2' },
					target: { id: 't9', language: 'en', key: 'k', value: 'v1' },
				}),
				row({
					id: 'access/permission:p:a:delete',
					group: 'access',
					kind: 'permission',
					key: 'p:a:delete',
					state: 'target_only',
					target: { id: 42 },
				}),
			],
			ctx,
		);

		expect(log.calls).toEqual([
			'permissions.createOne([{"policy":"p","collection":"a","action":"read"}])',
			'translations.updateOne(["t9",{"language":"en","key":"k","value":"v2"}])',
		]);
		expect(counts).toMatchObject({
			created: { access: 1 },
			updated: { translations: 1 },
			deleted: {},
			deletedLabels: [],
		});
	});

	test('settings: one upsert with every ticked field; extensions: `enabled` on the target row', async () => {
		await writeRows(
			[
				row({
					id: 'settings/field:project_name',
					group: 'settings',
					kind: 'field',
					key: 'project_name',
					state: 'changed',
					source: { project_name: 'A' },
				}),
				row({
					id: 'settings/field:project_color',
					group: 'settings',
					kind: 'field',
					key: 'project_color',
					state: 'changed',
					source: { project_color: '#fff' },
				}),
				row({
					id: 'extensions/extension:e',
					group: 'extensions',
					kind: 'extension',
					key: 'e',
					state: 'changed',
					source: { enabled: false },
					target: { id: 'ext-9' },
				}),
			],
			ctx,
		);

		expect(log.calls).toEqual([
			'directus_settings.upsertSingleton([{"project_name":"A","project_color":"#fff"}])',
			'extensions.updateOne(["ext-9",{"meta":{"enabled":false}}])',
		]);
	});

	test('a failed write names its row in the error', async () => {
		log.fail = 'policies.createOne';
		const error = await writeRows(
			[
				row({
					id: 'access/policy:p1',
					group: 'access',
					kind: 'policy',
					key: 'p1',
					state: 'source_only',
					source: { id: 'p1' },
				}),
			],
			ctx,
		).catch((e) => e);

		expect(error.extensions).toMatchObject({ reason: 'boom', row: 'access/policy:p1' });
	});
});

test('assertCallerAdmin: refused when neither the roles nor the user still give admin access', async () => {
	vi.mocked(fetchGlobalAccessForRoles).mockResolvedValue({ admin: false, app: true });
	vi.mocked(fetchGlobalAccessForUser).mockResolvedValue({ admin: true, app: true });
	await expect(assertCallerAdmin(ctx)).resolves.toBeUndefined();

	vi.mocked(fetchGlobalAccessForUser).mockResolvedValue({ admin: false, app: true });
	await expect(assertCallerAdmin(ctx)).rejects.toThrow('This change would remove your own admin access');
});

describe('afterCommit', () => {
	test('caches once, flows and extensions only when written, indexes one by one; failures are warnings', async () => {
		managers.extReload.mockRejectedValueOnce(new Error('down'));

		const result = await afterCommit(
			new Set(['flows', 'extensions', 'indexes']),
			[
				row({
					id: 'indexes/index:a:i1',
					group: 'indexes',
					kind: 'index',
					key: 'a:i1',
					state: 'source_only',
					source: { collection: 'a', name: 'i1', fields: ['x'], type: 'btree', unique: false },
				}),
				row({
					id: 'indexes/index:a:i2',
					group: 'indexes',
					kind: 'index',
					key: 'a:i2',
					state: 'target_only',
					target: { collection: 'a', name: 'i2' },
				}),
			],
			ctx,
		);

		expect(managers.cache).toHaveBeenCalledTimes(1);
		expect(managers.perms).toHaveBeenCalledTimes(1);
		expect(managers.flows).toHaveBeenCalledTimes(1);
		expect(result.warnings).toEqual(['extensions']);
		expect(result.indexes).toEqual([
			{ collection: 'a', name: 'i1', action: 'create', status: 'creating' },
			{ collection: 'a', name: 'i2', action: 'delete', status: 'done' },
		]);
	});

	test('nothing written: no cache clear, no reload', async () => {
		await afterCommit(new Set(), [], ctx);
		expect(managers.cache).not.toHaveBeenCalled();
		expect(managers.flows).not.toHaveBeenCalled();
	});
});

test('selectSchemaDiff: a new collection brings its new fields; other fields and relations only when ticked', () => {
	const snap = (collections: string[], fields: [string, string][]) =>
		({
			version: 1,
			directus: '11.17.4',
			vendor: 'postgres',
			collections: collections.map((c) => ({ collection: c, meta: { collection: c }, schema: { name: c } })),
			fields: fields.map(([c, f]) => ({
				collection: c,
				field: f,
				type: 'string',
				meta: { collection: c, field: f },
				schema: { name: f, table: c },
			})),
			relations: [],
		}) as unknown as Snapshot;

	const source = snap(
		['a', 'b'],
		[
			['a', 'id'],
			['a', 'x'],
			['a', 'y'],
			['b', 'id'],
		],
	);
	const target = snap(['a'], [['a', 'id']]);

	expect(selectSchemaDiff([], source, target)).toBeNull();

	const diff = selectSchemaDiff(
		[
			row({ id: 'schema/collection:b', group: 'schema', kind: 'collection', key: 'b', state: 'source_only' }),
			row({ id: 'schema/field:a.x', group: 'schema', kind: 'field', key: 'a.x', state: 'source_only' }),
		],
		source,
		target,
	)!;

	expect(diff.collections.map((c) => c.collection)).toEqual(['b']);
	expect(diff.fields.map((f) => `${f.collection}.${f.field}`).sort()).toEqual(['a.x', 'b.id']);
	expect(diff.systemFields).toEqual([]);
});
