import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import { validateStorageDrivers } from './validate-storage-drivers.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js');

const logger = { error: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

test('local and s3 pass', () => {
	const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	vi.mocked(useEnv).mockReturnValue({
		STORAGE_LOCATIONS: 'local,s3',
		STORAGE_LOCAL_DRIVER: 'local',
		STORAGE_S3_DRIVER: 's3',
	});
	validateStorageDrivers();
	expect(exit).not.toHaveBeenCalled();
	exit.mockRestore();
});

test.each(['gcs', 'azure', 'cloudinary', 'supabase'])('%s stops with the location and driver named', (driver) => {
	const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	vi.mocked(useEnv).mockReturnValue({
		STORAGE_LOCATIONS: ['local', 'files'],
		STORAGE_LOCAL_DRIVER: 'local',
		STORAGE_FILES_DRIVER: driver,
	});
	validateStorageDrivers();
	expect(logger.error).toHaveBeenCalledWith(
		`Storage location "files" uses driver "${driver}", which is not supported by Backoffice. Supported drivers: local, s3.`,
	);
	expect(exit).toHaveBeenCalledWith(1);
	exit.mockRestore();
});
