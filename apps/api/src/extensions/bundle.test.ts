// Spec 020 (T140, FR-060, D-137, R-63): the app bundle the manager builds from the fixture extensions with rollup:
// shared dependencies stay bare specifiers for the import map of the web app, disabled extensions are left out, the
// chunk names are stable between two builds of the same files, and a first build that fails serves no chunk.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFsExtensions } from '@backoffice/extensions/node';
import { rollup } from 'rollup';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { getExtensionsSettings } from './lib/get-extensions-settings.js';
import { getExtensions } from './lib/get-extensions.js';
import { ExtensionManager } from './manager.js';

const { env, logger } = vi.hoisted(() => ({
	env: {} as Record<string, unknown>,
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@backoffice/env', () => ({ useEnv: () => env }));
vi.mock('../logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('../bus/index.js', () => ({ useBus: () => ({ publish: vi.fn(), subscribe: vi.fn() }) }));
vi.mock('../database/index.js', () => ({ default: vi.fn(() => ({})) }));
vi.mock('../schema/get-database-schema.js', () => ({ getSchema: vi.fn(async () => ({})) }));
vi.mock('../flows.js', () => ({ getFlowManager: () => ({ addOperation: vi.fn(), removeOperation: vi.fn() }) }));
vi.mock('../operations/index.js', () => ({ operations: [] }));
vi.mock('../services/index.js', () => ({}));
vi.mock('./services.js', () => ({ extraServices: async () => ({}) }));
vi.mock('./lib/get-extensions.js', () => ({ getExtensions: vi.fn() }));
vi.mock('./lib/get-extensions-settings.js', () => ({ getExtensionsSettings: vi.fn() }));
vi.mock('./lib/installation/index.js', () => ({ getInstallationManager: () => ({}) }));
vi.mock('./lib/sync/sync.js', () => ({ syncExtensions: vi.fn(), clearOwnSyncLock: vi.fn() }));
vi.mock('rollup', async (original) => ({ rollup: vi.fn((await original<typeof import('rollup')>()).rollup) }));

const FIXTURES = join(import.meta.dirname, '../../../../tests/fixtures/extensions');
let temp: string;

async function build(disabled: string[] = []) {
	// Only the app side matters here: API extensions are left disabled so nothing is imported or sandboxed.
	const local = await resolveFsExtensions(FIXTURES);
	const appTypes = new Set(['interface', 'display', 'layout', 'module', 'panel', 'operation', 'bundle']);

	vi.mocked(getExtensions).mockResolvedValue({ local, registry: new Map(), module: new Map() });

	vi.mocked(getExtensionsSettings).mockResolvedValue(
		[...local.values()].map((ext, i) => ({
			id: String(i),
			source: 'local',
			folder: ext.name,
			enabled: appTypes.has(ext.type) && ext.type !== 'operation' && !disabled.includes(ext.name),
			bundle: null,
		})),
	);

	const manager = new ExtensionManager();
	await manager.initialize({ watch: false });
	return manager;
}

async function read(manager: ExtensionManager, name?: string) {
	const stream = await manager.getAppExtensionChunk(name);
	if (!stream) return null;
	let text = '';
	for await (const chunk of stream) text += chunk.toString();
	return text;
}

beforeAll(async () => {
	temp = await mkdtemp(join(tmpdir(), 'bo-ext-bundle-'));
});

afterAll(async () => {
	await rm(temp, { recursive: true, force: true });
});

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign(env, { TEMP_PATH: temp });
});

test('shared dependencies stay bare specifiers; disabled extensions are left out', async () => {
	const manager = await build(['parity-display-badge']);
	const index = (await read(manager))!;

	expect(index).toMatch(/from\s*["']vue["']/);
	expect(index).not.toContain('/admin/assets/');
	expect(index).toContain('parity-interface-color');
	expect(index).not.toContain('parity-display-badge');

	await manager.unload();
}, 120_000);

test('the chunk names are stable between two builds of the same files', async () => {
	const first = await build();
	const names = (first as unknown as { appExtensionChunks: string[] }).appExtensionChunks;
	await first.unload();

	const second = await build();
	expect((second as unknown as { appExtensionChunks: string[] }).appExtensionChunks).toEqual(names);
	expect(await read(second, 'nope.js')).toBeNull();
	await second.unload();
}, 120_000);

test('a first build that fails serves no chunk (R-63)', async () => {
	await rm(join(temp, 'app-extensions'), { recursive: true, force: true });
	vi.mocked(rollup).mockRejectedValueOnce(new Error('broken'));

	const manager = await build();

	expect(await read(manager)).toBeNull();
	expect(logger.warn).toHaveBeenCalledWith("Couldn't bundle App extensions");
	await manager.unload();
}, 120_000);
