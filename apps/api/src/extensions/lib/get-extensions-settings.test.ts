// Ported from directus/api/src/extensions/lib/get-extensions-settings.test.ts
// Backoffice: the lock is mocked here; settings-lock.test.ts covers it (R-58).
import { useEnv } from '@backoffice/env';
import { list } from '../registry/index.js';
import type { Extension } from '@backoffice/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getExtensionsSettings } from './get-extensions-settings.js';

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({})),
}));

vi.mock('../registry/index.js', () => ({
	list: vi.fn(),
}));

const mockWithSettingsLock = vi.fn((fn: () => unknown) => fn());
vi.mock('./settings-lock.js', () => ({ withSettingsLock: (fn: () => unknown) => mockWithSettingsLock(fn) }));

vi.mock('../../database/index.js', () => ({
	default: vi.fn(() => ({})),
}));

vi.mock('../../schema/get-database-schema.js', () => ({
	getSchema: vi.fn(() => ({})),
}));

const mockReadByQuery = vi.fn();
const mockCreateMany = vi.fn();
const mockDeleteMany = vi.fn();

vi.mock('../../services/extensions.service.js', () => ({
	ExtensionsService: vi.fn(function () {
		return {
			extensionsItemService: {
				readByQuery: mockReadByQuery,
				createMany: mockCreateMany,
				deleteMany: mockDeleteMany,
			},
		};
	}),
}));

const MOCK_EXTENSION_ID = 'test-marketplace-id';

const mockRegistryExtension: Extension = {
	name: 'directus-extension-test',
	type: 'interface',
	path: './extensions/.registry/some-folder',
	local: false,
	entrypoint: 'index.js',
	host: '^11.0.0',
	version: '1.0.0',
};

beforeEach(() => {
	vi.clearAllMocks();
	mockReadByQuery.mockResolvedValue([]);
});

describe('getExtensionsSettings', () => {
	describe('MARKETPLACE_REGISTRY', () => {
		test('should pass MARKETPLACE_REGISTRY to list() when set', async () => {
			const customRegistry = 'https://custom-registry.example.com';

			vi.mocked(useEnv).mockReturnValue({ MARKETPLACE_REGISTRY: customRegistry } as any);

			vi.mocked(list).mockResolvedValue({
				data: [{ id: MOCK_EXTENSION_ID, name: mockRegistryExtension.name }],
				meta: {},
			} as any);

			const registryMap = new Map<string, Extension>();
			registryMap.set('some-folder', mockRegistryExtension);

			await getExtensionsSettings({
				local: new Map(),
				module: new Map(),
				registry: registryMap,
			});

			expect(list).toHaveBeenCalledWith({ search: mockRegistryExtension.name }, { registry: customRegistry });
		});

		test('should pass empty options to list() when MARKETPLACE_REGISTRY is not set', async () => {
			vi.mocked(useEnv).mockReturnValue({} as any);

			vi.mocked(list).mockResolvedValue({
				data: [{ id: MOCK_EXTENSION_ID, name: mockRegistryExtension.name }],
				meta: {},
			} as any);

			const registryMap = new Map<string, Extension>();
			registryMap.set('some-folder', mockRegistryExtension);

			await getExtensionsSettings({
				local: new Map(),
				module: new Map(),
				registry: registryMap,
			});

			expect(list).toHaveBeenCalledWith({ search: mockRegistryExtension.name }, {});
		});

		test('should not call list() for local extensions', async () => {
			const localMap = new Map<string, Extension>();
			localMap.set('local-folder', { ...mockRegistryExtension, local: true });

			await getExtensionsSettings({
				local: localMap,
				module: new Map(),
				registry: new Map(),
			});

			expect(list).not.toHaveBeenCalled();
		});
	});

	// Backoffice: the lock only to write, so a node never waits for it while an uninstall deletes a row (the row would
	// be created again by the waiting node).
	describe('settings lock', () => {
		test('every extension has its row: read without the lock, nothing written', async () => {
			const row = { id: 'row-1', source: 'registry', folder: 'some-folder', bundle: null, enabled: true };
			mockReadByQuery.mockResolvedValue([row]);

			const settings = await getExtensionsSettings({
				local: new Map(),
				module: new Map(),
				registry: new Map([['some-folder', mockRegistryExtension]]),
			});

			expect(settings).toEqual([row]);
			expect(mockWithSettingsLock).not.toHaveBeenCalled();
			expect(mockCreateMany).not.toHaveBeenCalled();
		});

		test('a row to create: created inside the lock', async () => {
			vi.mocked(list).mockResolvedValue({ data: [], meta: {} } as any);

			await getExtensionsSettings({
				local: new Map([['local-folder', { ...mockRegistryExtension, local: true }]]),
				module: new Map(),
				registry: new Map(),
			});

			expect(mockWithSettingsLock).toHaveBeenCalledTimes(1);
			expect(mockCreateMany).toHaveBeenCalledTimes(1);
		});
	});
});
