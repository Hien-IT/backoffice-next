// Ported from directus/api/src/services/extensions.test.ts, extended for spec 020 (readAll, updateOne, deleteOne,
// uninstall, reinstall, the extensions limit).
import { ServiceUnavailableError } from '@backoffice/errors';
import { useEnv } from '@backoffice/env';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getExtensionManager } from '../extensions/index.js';
import { describe as registryDescribe } from '../extensions/registry/index.js';
import { ExtensionsService } from './extensions.service.js';
import { ItemsService } from './items.service.js';

vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({})) }));
vi.mock('../extensions/registry/index.js', () => ({ describe: vi.fn() }));
vi.mock('../extensions/index.js', () => ({ getExtensionManager: vi.fn() }));

// Backoffice (spec 031): the installation manager and the settings lock of installUpload.
const installation = vi.hoisted(() => ({
	installFromStream: vi.fn(),
	activateUpload: vi.fn(async () => undefined),
	readUploadedName: vi.fn(),
	uninstall: vi.fn(async () => undefined),
}));
const lock = vi.hoisted(() => ({ withSettingsLock: vi.fn((fn: () => unknown) => fn()) }));
vi.mock('../extensions/lib/installation/index.js', () => ({ getInstallationManager: () => installation }));
vi.mock('../extensions/lib/settings-lock.js', () => lock);
vi.mock('./items.service.js', () => ({ ItemsService: vi.fn() }));
vi.mock('../database/index.js', () => ({ default: vi.fn() }));

vi.mock('../utils/transaction.js', () => ({
	transaction: vi.fn(async (knex: unknown, fn: (trx: unknown) => unknown) => fn(knex)),
}));

describe('ExtensionsService', () => {
	let manager: any;
	let items: any;

	const service = () => new ExtensionsService({ knex: {} as any, schema: {} as any, accountability: null });

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useEnv).mockReturnValue({});

		items = {
			createOne: vi.fn(),
			createMany: vi.fn(),
			readOne: vi.fn(),
			updateOne: vi.fn(),
			deleteOne: vi.fn(),
			deleteByQuery: vi.fn(async () => []),
			readByQuery: vi.fn(),
		};

		manager = {
			install: vi.fn(),
			uninstall: vi.fn(),
			installed: vi.fn(),
			getExtensionSourceByName: vi.fn(),
			extensions: [],
			getExtension: vi.fn(),
			reload: vi.fn(() => Promise.resolve()),
			isReloading: vi.fn(() => Promise.resolve()),
			broadcastReloadNotification: vi.fn(),
		};

		vi.mocked(getExtensionManager).mockReturnValue(manager);
		vi.mocked(ItemsService).mockImplementation(function () {
			return items;
		} as any);

		vi.mocked(registryDescribe).mockResolvedValue({
			data: { type: 'interface', versions: [{ id: 'test-version', bundled: [] }] },
		} as any);
	});

	describe('install', () => {
		test('should propagate extension manager install error', async () => {
			manager.install.mockRejectedValue(
				new ServiceUnavailableError({ service: 'marketplace', reason: 'Could not download the extension' }),
			);

			await expect(service().install('test-extension', 'test-version')).rejects.toThrow(
				'Could not download the extension',
			);
		});

		test('creates the row, then the bundle entries, then installs', async () => {
			vi.mocked(registryDescribe).mockResolvedValue({
				data: { type: 'bundle', versions: [{ id: 'v', bundled: [{ name: 'a', type: 'hook' }] }] },
			} as any);

			await service().install('ext', 'v');

			expect(items.createOne).toHaveBeenCalledWith({
				id: 'ext',
				enabled: true,
				folder: 'v',
				source: 'registry',
				bundle: null,
			});

			expect(items.createMany).toHaveBeenCalledWith([
				{ enabled: true, folder: 'a', source: 'registry', bundle: 'ext' },
			]);
			expect(manager.install).toHaveBeenCalledWith('v');
		});

		test('an unknown version is forbidden', async () => {
			await expect(service().install('ext', 'other')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		});

		test('EXTENSIONS_LIMIT counts the loaded extensions and the bundled entries', async () => {
			vi.mocked(useEnv).mockReturnValue({ EXTENSIONS_LIMIT: '2' });
			manager.extensions = [{}, {}];

			await expect(service().install('ext', 'test-version')).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
		});
	});

	describe('uninstall and reinstall', () => {
		test('only registry extensions that are not bundle entries', async () => {
			items.readOne.mockResolvedValueOnce({ id: 'x', source: 'local', bundle: null, folder: 'f' });
			await expect(service().uninstall('x')).rejects.toThrow(
				'Cannot uninstall extensions that were not installed via marketplace',
			);

			items.readOne.mockResolvedValueOnce({ id: 'x', source: 'registry', bundle: 'p', folder: 'f' });
			await expect(service().uninstall('x')).rejects.toThrow('Cannot uninstall sub extensions of bundles separately');

			items.readOne.mockResolvedValueOnce({ id: 'x', source: 'local', bundle: null, folder: 'f' });
			await expect(service().reinstall('x')).rejects.toThrow(
				'Cannot reinstall extensions that were not installed via marketplace',
			);

			items.readOne.mockResolvedValueOnce({ id: 'x', source: 'registry', bundle: 'p', folder: 'f' });
			await expect(service().reinstall('x')).rejects.toThrow('Cannot reinstall sub extensions of bundles separately');
		});

		test('uninstall deletes the rows then the files', async () => {
			items.readOne.mockResolvedValue({ id: 'x', source: 'registry', bundle: null, folder: 'v' });

			await service().uninstall('x');

			expect(items.deleteOne).toHaveBeenCalledWith('x');
			expect(items.deleteByQuery).toHaveBeenCalledWith({ filter: { bundle: { _eq: 'x' } } });
			expect(manager.uninstall).toHaveBeenCalledWith('v', 'registry');
		});

		test('reinstall checks the version again and installs the same folder', async () => {
			items.readOne.mockResolvedValue({ id: 'ext', source: 'registry', bundle: null, folder: 'test-version' });

			await service().reinstall('ext');

			expect(manager.install).toHaveBeenCalledWith('test-version');
		});
	});

	describe('readAll', () => {
		test('top level rows with the loaded schema, bundle entries from the parent schema', async () => {
			const bundle = { type: 'bundle', entries: [{ name: 'a', type: 'hook' }] };
			manager.getExtension.mockImplementation((_source: string, folder: string) =>
				folder === 'b' ? bundle : undefined,
			);

			items.readByQuery.mockResolvedValue([
				{ id: '1', bundle: null, source: 'local', folder: 'b', enabled: true },
				{ id: '2', bundle: '1', source: 'local', folder: 'a', enabled: true },
				{ id: '3', bundle: '1', source: 'local', folder: 'gone', enabled: true },
				{ id: '4', bundle: null, source: 'local', folder: 'missing', enabled: true },
				{ id: '5', bundle: '9', source: 'local', folder: 'orphan', enabled: true },
			]);

			const output = await service().readAll();

			expect(manager.isReloading).toHaveBeenCalled();
			expect(output.map((o) => [o.id, o.schema])).toEqual([
				['1', bundle],
				['4', null],
				['2', { name: 'a', type: 'hook' }],
			]);
		});
	});

	describe('updateOne', () => {
		test('meta is required', async () => {
			await expect(service().updateOne('x', {} as any)).rejects.toThrow('"meta" is required');
		});

		test('updates, reads, reloads and broadcasts', async () => {
			items.readOne.mockResolvedValue({ id: 'x', source: 'local', bundle: null, folder: 'f', enabled: false });
			manager.getExtension.mockReturnValue({ type: 'hook' });

			const result = await service().updateOne('x', { meta: { enabled: false } } as any);

			expect(items.updateOne).toHaveBeenCalledWith('x', { enabled: false });
			expect(result).toMatchObject({ id: 'x', schema: { type: 'hook' } });
			await vi.waitFor(() => expect(manager.broadcastReloadNotification).toHaveBeenCalled());
		});

		test('toggling a bundle updates its entries', async () => {
			const update = { update: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orWhere: vi.fn() };
			const knex = vi.fn(() => update);
			items.readOne.mockResolvedValue({ id: 'b', source: 'local', bundle: null, folder: 'f', enabled: true });
			manager.getExtension.mockReturnValue({ type: 'bundle', entries: [] });

			await new ExtensionsService({ knex: knex as any, schema: {} as any }).updateOne('b', {
				meta: { enabled: true },
			} as any);

			expect(update.update).toHaveBeenCalledWith({ enabled: true });
			expect(update.where).toHaveBeenCalledWith({ bundle: 'b' });
			expect(update.orWhere).toHaveBeenCalledWith({ id: 'b' });
		});

		test('an entry of a non partial bundle cannot be toggled', async () => {
			const knex = vi.fn();
			items.readOne.mockImplementation(async (id: string) =>
				id === 'e'
					? { id: 'e', source: 'local', bundle: 'b', folder: 'a', enabled: false }
					: { id: 'b', source: 'local', bundle: null, folder: 'f', enabled: true },
			);

			manager.getExtension.mockImplementation((_s: string, folder: string) =>
				folder === 'f' ? { type: 'bundle', partial: false, entries: [] } : undefined,
			);

			await expect(
				new ExtensionsService({ knex: knex as any, schema: {} as any }).updateOne('e', {
					meta: { enabled: false },
				} as any),
			).rejects.toThrow('Unable to toggle status of an entry for a bundle marked as non partial');
		});
	});

	test('deleteOne deletes the row and its bundle entries', async () => {
		await service().deleteOne('x');

		expect(items.deleteOne).toHaveBeenCalledWith('x');
		expect(items.deleteByQuery).toHaveBeenCalledWith({ filter: { bundle: { _eq: 'x' } } });
	});

	// Backoffice (spec 031, D-212, research R5).
	describe('installUpload', () => {
		const stream = {} as any;
		const endpoint = {
			name: 'parity-upload-endpoint',
			version: '1.0.0',
			'directus:extension': { type: 'endpoint', path: 'dist/index.js', host: '^11.0.0', sandbox: { enabled: true } },
		};
		const bundle = {
			name: 'parity-upload-bundle',
			version: '1.0.0',
			'directus:extension': {
				type: 'bundle',
				path: { app: 'dist/app.js', api: 'dist/api.js' },
				entries: [
					{ type: 'interface', name: 'upload-iface' },
					{ type: 'display', name: 'upload-display' },
				],
				host: '^11.0.0',
			},
		};

		/** installFromStream returns `manifest` after running the check on it, as the real one does. */
		function returns(manifest: any) {
			installation.installFromStream.mockImplementation(async (_s: unknown, _id: string, check: (m: any) => void) => {
				await check(manifest);
				return manifest;
			});
		}

		beforeEach(() => {
			items.readByQuery.mockResolvedValue([]);
			items.readOne.mockImplementation(async (id: string) => ({ id, source: 'upload', folder: id, bundle: null }));
		});

		test('copies the package to .upload/<uuid v4>, writes the row in the lock, then every node reloads', async () => {
			returns(endpoint);

			const output = await service().installUpload(stream);

			const id = installation.installFromStream.mock.calls[0]![1];
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
			expect(lock.withSettingsLock).toHaveBeenCalledTimes(1);
			expect(items.createOne).toHaveBeenCalledWith({ id, enabled: true, folder: id, source: 'upload', bundle: null });
			expect(items.createMany).not.toHaveBeenCalled();
			// Activated after its row, inside the lock, before the other nodes are told to reload.
			expect(installation.activateUpload).toHaveBeenCalledWith(id);
			expect(installation.activateUpload.mock.invocationCallOrder[0]).toBeGreaterThan(
				items.createOne.mock.invocationCallOrder[0],
			);
			expect(manager.installed.mock.invocationCallOrder[0]).toBeGreaterThan(
				installation.activateUpload.mock.invocationCallOrder[0]!,
			);
			expect(manager.installed).toHaveBeenCalledWith({ source: 'upload', folder: id });
			expect(output).toMatchObject({ id, meta: { source: 'upload' } });
			expect(installation.uninstall).not.toHaveBeenCalled();
		});

		test('a bundle gets one entry row per entry, of source upload, under the parent id', async () => {
			returns(bundle);

			await service().installUpload(stream);

			const id = installation.installFromStream.mock.calls[0]![1];
			expect(items.createMany).toHaveBeenCalledWith([
				{ enabled: true, folder: 'upload-iface', source: 'upload', bundle: id },
				{ enabled: true, folder: 'upload-display', source: 'upload', bundle: id },
			]);
		});

		test('rows a node already created for the folder are not written twice', async () => {
			returns(bundle);
			installation.installFromStream.mockImplementationOnce(async (_s: unknown, id: string, check: any) => {
				await check(bundle);
				items.readByQuery.mockResolvedValue([
					{ id, source: 'upload', folder: id, bundle: null, enabled: true },
					{ id: 'e1', source: 'upload', folder: 'upload-iface', bundle: id, enabled: true },
				]);
				return bundle;
			});

			await service().installUpload(stream);

			const id = installation.installFromStream.mock.calls[0]![1];
			expect(items.createOne).not.toHaveBeenCalled();
			expect(items.createMany).toHaveBeenCalledWith([
				{ enabled: true, folder: 'upload-display', source: 'upload', bundle: id },
			]);
		});

		test('a name loaded under any source is refused before the copy', async () => {
			manager.getExtensionSourceByName.mockReturnValue('local');
			returns(endpoint);

			await expect(service().installUpload(stream)).rejects.toMatchObject({
				status: 400,
				extensions: { reason: 'An extension named "parity-upload-endpoint" is already installed (local)' },
			});
			expect(items.createOne).not.toHaveBeenCalled();
		});

		test('in the lock, an upload of another node with the same name wins: files and rows removed, 400', async () => {
			returns(endpoint);
			items.readByQuery.mockResolvedValue([
				{ id: 'other', source: 'upload', folder: 'other', bundle: null, enabled: true },
			]);
			installation.readUploadedName.mockResolvedValue('parity-upload-endpoint');

			await expect(service().installUpload(stream)).rejects.toMatchObject({
				extensions: { reason: 'An extension named "parity-upload-endpoint" is already installed (upload)' },
			});

			const id = installation.installFromStream.mock.calls[0]![1];
			expect(installation.readUploadedName).toHaveBeenCalledWith('other');
			expect(items.createOne).not.toHaveBeenCalled();
			expect(installation.activateUpload).not.toHaveBeenCalled();
			expect(installation.uninstall).toHaveBeenCalledWith(id, 'upload');
			expect(items.deleteByQuery).toHaveBeenCalledWith({
				filter: {
					_or: [
						{ id: { _eq: id } },
						{ bundle: { _eq: id } },
						{ _and: [{ folder: { _eq: id } }, { source: { _eq: 'upload' } }] },
					],
				},
			});
			expect(manager.installed).not.toHaveBeenCalled();
		});

		test('MARKETPLACE_TRUST=sandbox: a package with an API part must be sandboxed, an app-only one is accepted', async () => {
			vi.mocked(useEnv).mockReturnValue({ MARKETPLACE_TRUST: 'sandbox' });
			const unsandboxed = { ...endpoint, 'directus:extension': { ...endpoint['directus:extension'], sandbox: undefined } };
			returns(unsandboxed);

			await expect(service().installUpload(stream)).rejects.toMatchObject({
				extensions: { reason: 'MARKETPLACE_TRUST=sandbox requires a sandboxed extension' },
			});

			returns(bundle);
			await expect(service().installUpload(stream)).resolves.toBeDefined();

			const apiBundle = {
				...bundle,
				'directus:extension': {
					...bundle['directus:extension'],
					entries: [{ type: 'hook', name: 'h' }],
				},
			};
			returns(apiBundle);
			await expect(service().installUpload(stream)).rejects.toMatchObject({
				extensions: { reason: 'MARKETPLACE_TRUST=sandbox requires a sandboxed extension' },
			});

			vi.mocked(useEnv).mockReturnValue({});
			returns(unsandboxed);
			await expect(service().installUpload(stream)).resolves.toBeDefined();
		});

		test('EXTENSIONS_LIMIT: a bundle counts its entries', async () => {
			vi.mocked(useEnv).mockReturnValue({ EXTENSIONS_LIMIT: '3' });
			manager.extensions = [{}];
			returns(bundle);

			await expect(service().installUpload(stream)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });

			returns(endpoint);
			await expect(service().installUpload(stream)).resolves.toBeDefined();
		});

		test('uninstall: an upload row is removed with its folder; reinstall refuses it', async () => {
			items.readOne.mockResolvedValue({ id: 'u', source: 'upload', bundle: null, folder: 'u' });

			await service().uninstall('u');

			expect(items.deleteOne).toHaveBeenCalledWith('u');
			expect(manager.uninstall).toHaveBeenCalledWith('u', 'upload');

			await expect(service().reinstall('u')).rejects.toThrow(
				'Cannot reinstall extensions that were not installed via marketplace',
			);

			items.readOne.mockResolvedValue({ id: 'e', source: 'upload', bundle: 'u', folder: 'upload-iface' });
			await expect(service().uninstall('e')).rejects.toThrow('Cannot uninstall sub extensions of bundles separately');
		});
	});
});
