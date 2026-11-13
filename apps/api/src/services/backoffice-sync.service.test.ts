// Backoffice (spec 032, contracts/tests.md §1): instance info, the version and migration check, the group list, and the
// order of a comparison (refused before any config is read).
import type { SchemaOverview } from '@backoffice/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { afterCommit, applySchema, assertCallerAdmin, writeRows } from '../sync/apply.js';
import { fetchInfo, fetchState } from '../sync/source.js';
import { readState } from '../sync/state.js';
import type { SyncRow } from '../sync/types.js';
import { BackofficeSyncService, compareInfo, parseGroups, validateSelection } from './backoffice-sync.service.js';

vi.mock('../database/index.js', () => ({ default: () => ({}), getDatabaseClient: () => 'postgres' }));
vi.mock('../database/validate-migrations.js', () => ({
	checkMigrations: vi.fn(async () => ({ completed: ['20201028A', '20201029A'], boCompleted: ['20261026A'] })),
}));
vi.mock('../version.js', () => ({ BACKOFFICE_VERSION: '1.2.3' }));
vi.mock('../sync/source.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../sync/source.js')>()),
	fetchInfo: vi.fn(),
	fetchState: vi.fn(),
}));
const lock = vi.hoisted(() => ({ usingLock: vi.fn(async (_key: string, run: () => Promise<unknown>) => run()) }));
vi.mock('../lock/index.js', () => ({ useLock: () => lock }));
vi.mock('../utils/transaction.js', () => ({
	transaction: async (knex: unknown, run: (trx: unknown) => unknown) => run(knex),
}));
vi.mock('../schema/get-database-schema.js', () => ({
	getSchema: vi.fn(async () => ({ collections: {}, relations: [] })),
}));
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('../sync/apply.js', () => ({
	applySchema: vi.fn(async () => false),
	writeRows: vi.fn(async () => ({ created: { flows: 1 }, updated: {}, deleted: {}, deletedLabels: [] })),
	assertCallerAdmin: vi.fn(),
	afterCommit: vi.fn(async () => ({ indexes: [], warnings: [] })),
}));
vi.mock('../sync/state.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../sync/state.js')>()),
	readState: vi.fn(async () => ({ folders: [] })),
}));

const schema = { collections: {}, relations: [] } as unknown as SchemaOverview;
const service = (admin = true) =>
	new BackofficeSyncService({ schema, accountability: { admin } as never, knex: {} as never });

const target = {
	backoffice: '1.2.3',
	directus: '11.17.4',
	vendor: 'postgres',
	migrations: { directus: ['20201028A', '20201029A'], backoffice: ['20261026A'] },
};

afterEach(() => vi.clearAllMocks());

test('info: Backoffice and DR versions, vendor, sorted migration lists; admin only', async () => {
	await expect(service().info()).resolves.toEqual(target);
	await expect(service(false).info()).rejects.toMatchObject({ status: 403 });
});

describe('compareInfo', () => {
	test('refuses another Backoffice or DR version, naming both', () => {
		expect(() => compareInfo({ ...target, backoffice: '1.0.0' }, target, ['flows'])).toThrow(
			'Version mismatch: source Backoffice 1.0.0, target 1.2.3',
		);
		expect(() => compareInfo({ ...target, directus: '11.16.0' }, target, ['flows'])).toThrow('source Directus 11.16.0');
	});

	test('refuses other migration lists, counting the versions that differ', () => {
		const source = { ...target, migrations: { directus: ['20201028A'], backoffice: ['20261026A', 'custom'] } };
		expect(() => compareInfo(source, target, ['flows'])).toThrow('Migration mismatch: 2 differ');
	});

	test('another vendor only blocks the data model (clarify 5)', () => {
		const source = { ...target, vendor: 'sqlite' };
		expect(() => compareInfo(source, target, ['flows', 'access'])).not.toThrow();
		expect(() => compareInfo(source, target, ['schema'])).toThrow(
			'Data model cannot be compared between sqlite and postgres',
		);
	});
});

test('parseGroups: empty means all ten; unknown names are a 400; the order is the registry order', () => {
	expect(parseGroups(undefined)).toHaveLength(10);
	expect(parseGroups('folders,flows')).toEqual(['flows', 'folders']);
	expect(parseGroups(['access'])).toEqual(['access']);
	expect(() => parseGroups('flows,users')).toThrow('Unknown sync group "users"');
});

test('compare checks the versions before reading any config, then reads both sides', async () => {
	vi.mocked(fetchInfo).mockResolvedValueOnce({ ...target, backoffice: '9.9.9' });
	await expect(service().compare({ url: 'https://source.example', token: 't', groups: ['folders'] })).rejects.toThrow(
		'Version mismatch',
	);
	expect(fetchState).not.toHaveBeenCalled();
	expect(readState).not.toHaveBeenCalled();

	vi.mocked(fetchInfo).mockResolvedValueOnce(target);
	vi.mocked(fetchState).mockResolvedValueOnce({ folders: [{ id: 'a', name: 'A', parent: null }] });
	const diff = await service().diff({ url: 'https://source.example/', token: 't', groups: ['folders'] });

	expect(fetchInfo).toHaveBeenLastCalledWith('https://source.example', 't');
	expect(diff).toMatchObject({
		source: target,
		groups: ['folders'],
		rows: [{ id: 'folders/folder:a', state: 'source_only' }],
	});
	expect(diff.hash).toMatch(/^[0-9a-f]{40}$/);
});

const r = (id: string, over: Partial<SyncRow> = {}): SyncRow =>
	({
		id,
		group: 'access',
		kind: 'policy',
		key: id,
		label: id,
		state: 'source_only',
		depends: [],
		cascade: [],
		selectable: true,
		...over,
	}) as SyncRow;

describe('validateSelection', () => {
	const rows = [
		r('a'),
		r('b', { depends: ['a'] }),
		r('del', { state: 'target_only', cascade: ['child'] }),
		r('child', { state: 'target_only' }),
		r('blocked', { selectable: false, reason: 'sync_admin_protected' }),
		r('same', { state: 'same', selectable: false }),
	];

	test('returns the ticked rows in comparison order', () => {
		expect(validateSelection(rows, ['b', 'a']).map((x) => x.id)).toEqual(['a', 'b']);
	});

	test.each([
		[['zzz'], 'Unknown row "zzz"'],
		[['blocked'], 'Row "blocked" cannot be applied: sync_admin_protected'],
		[['same'], 'Row "same" cannot be applied'],
		[['b'], 'Row "b" needs "a"'],
		[['del'], 'Deleting "del" also deletes "child"'],
	])('%j → %s', (selected, message) => {
		expect(() => validateSelection(rows, selected)).toThrow(message);
	});
});

describe('apply', () => {
	const request = {
		url: 'https://source.example',
		token: 't',
		groups: ['folders'] as never,
		hash: 'h',
		selected: ['folders/folder:a'],
	};

	test('reads both sides again under the lock and refuses another hash before any write', async () => {
		vi.mocked(fetchInfo).mockResolvedValue(target);
		vi.mocked(fetchState).mockResolvedValue({ folders: [{ id: 'a', name: 'A', parent: null }] });

		await expect(service().apply(request)).rejects.toThrow('The comparison is out of date, compare again');
		expect(lock.usingLock).toHaveBeenCalledWith('backoffice-sync-apply', expect.any(Function));
		expect(writeRows).not.toHaveBeenCalled();
	});

	test('writes in one transaction, checks the caller, then runs the after-commit steps', async () => {
		vi.mocked(fetchInfo).mockResolvedValue(target);
		vi.mocked(fetchState).mockResolvedValue({ folders: [{ id: 'a', name: 'A', parent: null }] });
		const { hash } = await service().diff(request);

		const result = await service().apply({ ...request, hash });

		// No data model compared: applyDiff is never reached.
		expect(applySchema).not.toHaveBeenCalled();
		expect(vi.mocked(writeRows).mock.calls[0]![0].map((x) => x.id)).toEqual(['folders/folder:a']);
		expect(assertCallerAdmin).toHaveBeenCalledTimes(1);
		expect(afterCommit).toHaveBeenCalledWith(new Set(['flows']), [], expect.anything());
		expect(result).toEqual({
			created: { flows: 1 },
			updated: {},
			deleted: {},
			deletedLabels: [],
			indexes: [],
			warnings: [],
		});
	});

	test('a second apply in the same process, or a lock held elsewhere, is a 503', async () => {
		let release!: () => void;
		lock.usingLock.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({}))));
		const first = service().apply(request);
		await expect(service().apply(request)).rejects.toMatchObject({ status: 503 });
		release();
		await first;

		lock.usingLock.mockRejectedValueOnce(Object.assign(new Error('quorum'), { name: 'ExecutionError' }));
		await expect(service().apply(request)).rejects.toThrow('Another sync is being applied');
	});
});
