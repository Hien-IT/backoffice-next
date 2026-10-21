// Ported from directus/api/src/cli/load-extensions.ts
import { useEnv } from '@backoffice/env';
import { isInstalled } from '../database/index.js';
import { migrationsValid as validateMigrations } from '../database/validate-migrations.js';
import { getExtensionManager } from '../extensions/index.js';
import { useLogger } from '../logger/index.js';

export const loadExtensions = async () => {
	const env = useEnv();
	const logger = useLogger();

	if (!('DB_CLIENT' in env)) return;

	const installed = await isInstalled();

	if (!installed) return;

	const migrationsValid = await validateMigrations();

	if (!migrationsValid) {
		logger.info('Skipping CLI extensions initialization due to outstanding migrations.');
		return;
	}

	const extensionManager = getExtensionManager();
	await extensionManager.initialize({ schedule: false, watch: false });
};
