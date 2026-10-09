import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import { validateStorage } from './validate-storage.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');

const logger = { warn: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

test('no warning when every directory is usable', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'storage-'));
	mkdirSync(join(dir, 'uploads'));
	mkdirSync(join(dir, 'extensions'));

	vi.mocked(useEnv).mockReturnValue({
		DB_CLIENT: 'sqlite3',
		DB_FILENAME: join(dir, 'data.db'),
		STORAGE_LOCATIONS: 'local',
		STORAGE_LOCAL_DRIVER: 'local',
		STORAGE_LOCAL_ROOT: join(dir, 'uploads'),
		EXTENSIONS_PATH: join(dir, 'extensions'),
	});

	await validateStorage();
	expect(logger.warn).not.toHaveBeenCalled();
});

test('warns like Directus for the SQLite, upload and extensions directories', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'storage-'));
	// A missing directory, not chmod: root (CI containers) can write to a read-only directory.
	const readOnly = join(dir, 'missing-database');

	vi.mocked(useEnv).mockReturnValue({
		DB_CLIENT: 'sqlite3',
		DB_FILENAME: join(readOnly, 'data.db'),
		STORAGE_LOCATIONS: 'local',
		STORAGE_LOCAL_DRIVER: 'local',
		STORAGE_LOCAL_ROOT: join(dir, 'missing-uploads'),
		EXTENSIONS_PATH: join(dir, 'missing-extensions'),
	});

	await validateStorage();

	expect(logger.warn.mock.calls.map(([m]) => m)).toEqual([
		`Directory for SQLite database file (${readOnly}) is not read/writeable!`,
		`Upload directory (${join(dir, 'missing-uploads')}) is not read/writeable!`,
		`Extensions directory (${join(dir, 'missing-extensions')}) is not readable!`,
	]);
});

test('extensions directory is not checked when EXTENSIONS_LOCATION is set', async () => {
	vi.mocked(useEnv).mockReturnValue({
		DB_CLIENT: 'pg',
		STORAGE_LOCATIONS: 's3',
		STORAGE_S3_DRIVER: 's3',
		EXTENSIONS_LOCATION: 's3',
		EXTENSIONS_PATH: '/missing',
	});
	await validateStorage();
	expect(logger.warn).not.toHaveBeenCalled();
});
