// Ported from directus/api/src/cli/commands/database/migrate.ts
import getDatabase from '../../../database/index.js';
import run from '../../../database/migrations/run.js';
import { useLogger } from '../../../logger/index.js';
import { unsupportedClient, vendorMessages } from '../../utils/assert-vendor.js';

export default async function migrate(direction: 'latest' | 'up' | 'down'): Promise<void> {
	const database = getDatabase();
	const logger = useLogger();

	// Backoffice (spec 021 D-145): other vendors are migrated by the Directus image.
	const client = unsupportedClient(database);

	if (client) {
		logger.error(vendorMessages.migrate(client));
		database.destroy();
		return process.exit(1);
	}

	try {
		logger.info('Running migrations...');

		await run(database, direction);

		if (direction === 'down') {
			logger.info('Downgrade successful');
		} else {
			logger.info('Database up to date');
		}

		database.destroy();
		process.exit();
	} catch (err: any) {
		logger.error(err);
		database.destroy();
		process.exit(1);
	}
}
