// Backoffice: DR has no unit test for cli/load-extensions.ts (spec 021 FR-043).
import { useEnv } from '@backoffice/env';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { isInstalled } from '../database/index.js';
import { migrationsValid } from '../database/validate-migrations.js';
import { getExtensionManager } from '../extensions/index.js';
import { useLogger } from '../logger/index.js';
import { loadExtensions } from './load-extensions.js';

vi.mock('@backoffice/env');
// Factories: an automock would evaluate the real modules (services read the env when they load).
vi.mock('../database/index.js', () => ({ isInstalled: vi.fn() }));
vi.mock('../database/validate-migrations.js', () => ({ migrationsValid: vi.fn() }));
vi.mock('../extensions/index.js', () => ({ getExtensionManager: vi.fn() }));
vi.mock('../logger/index.js');

const logger = { info: vi.fn() };
const manager = { initialize: vi.fn() };

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({ DB_CLIENT: 'pg' });
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getExtensionManager).mockReturnValue(manager as any);
	vi.mocked(isInstalled).mockResolvedValue(true);
	vi.mocked(migrationsValid).mockResolvedValue(true);
});

afterEach(() => vi.clearAllMocks());

test('initializes the extensions without schedules and without watching', async () => {
	await loadExtensions();

	expect(manager.initialize).toHaveBeenCalledWith({ schedule: false, watch: false });
});

test('no DB_CLIENT: nothing is read or loaded', async () => {
	vi.mocked(useEnv).mockReturnValue({});

	await loadExtensions();

	expect(isInstalled).not.toHaveBeenCalled();
	expect(manager.initialize).not.toHaveBeenCalled();
});

test('database not installed: skipped silently', async () => {
	vi.mocked(isInstalled).mockResolvedValue(false);

	await loadExtensions();

	expect(migrationsValid).not.toHaveBeenCalled();
	expect(manager.initialize).not.toHaveBeenCalled();
	expect(logger.info).not.toHaveBeenCalled();
});

test('missing migrations: skipped with the Directus log line', async () => {
	vi.mocked(migrationsValid).mockResolvedValue(false);

	await loadExtensions();

	expect(manager.initialize).not.toHaveBeenCalled();
	expect(logger.info).toHaveBeenCalledWith('Skipping CLI extensions initialization due to outstanding migrations.');
});
