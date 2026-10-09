import { useEnv } from '@backoffice/env';
import { toArray } from '@backoffice/utils';
import { useLogger } from '../logger/index.js';

export const SUPPORTED_STORAGE_DRIVERS = ['local', 's3'];

/**
 * FR-034, D-16: storage drivers other than local and s3 are out of scope (Principle XI). Running anyway would
 * mark the instance ready while every upload fails, so the API stops (deviation recorded in plan.md).
 */
export function validateStorageDrivers(): void {
	const env = useEnv();
	const logger = useLogger();

	for (const location of toArray(env['STORAGE_LOCATIONS'] as string)) {
		const driver = env[`STORAGE_${location.toUpperCase()}_DRIVER`];

		if (!SUPPORTED_STORAGE_DRIVERS.includes(driver as string)) {
			logger.error(
				`Storage location "${location}" uses driver "${driver}", which is not supported by Backoffice. Supported drivers: local, s3.`,
			);

			process.exit(1);
		}
	}
}
