// Ported from directus/api/src/cli/commands/database/install.ts
import getDatabase from '../../../database/index.js';
import installSeeds from '../../../database/seeds/run.js';
import { useLogger } from '../../../logger/index.js';
import { unsupportedClient, vendorMessages } from '../../utils/assert-vendor.js';

export default async function start(): Promise<void> {
	const database = getDatabase();
	const logger = useLogger();

	// Backoffice (spec 021 D-145): other vendors are installed by the Directus image.
	const client = unsupportedClient(database);

	if (client) {
		logger.error(vendorMessages.migrate(client));
		database.destroy();
		return process.exit(1);
	}

	try {
		await installSeeds(database);
		database.destroy();
		process.exit(0);
	} catch (err: any) {
		logger.error(err);
		database.destroy();
		process.exit(1);
	}
}
