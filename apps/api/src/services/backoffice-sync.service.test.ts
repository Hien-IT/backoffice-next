// Backoffice (spec 032, contracts/tests.md §1): instance info, the version and migration check, the group list, and the
// order of a comparison (refused before any config is read).
import type { SchemaOverview } from '@backoffice/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchInfo, fetchState } from '../sync/source.js';
import { readState } from '../sync/state.js';
import { BackofficeSyncService, compareInfo, parseGroups } from './backoffice-sync.service.js';

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
