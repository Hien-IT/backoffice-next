import { useEnv } from '@backoffice/env';
import { registerAuthProviders } from '../auth.js';
import { warnSingleInstance } from '../config/warn-single-instance.js';
import { warnUnsupportedVariables } from '../config/warn-unsupported-variables.js';
import { isInstalled, validateDatabaseConnection, validateDatabaseExtensions } from '../database/index.js';
import { validateMigrations } from '../database/validate-migrations.js';
import { useLogger } from '../logger/index.js';
import { Url } from '../utils/url.js';
import { validateStorage } from '../utils/validate-storage.js';
import { VERSION_LOG_LINE } from '../version.js';
import { validateStorageDrivers } from './validate-storage-drivers.js';

/**
 * Startup steps of contracts/startup.md §1, in order, before the server listens. Every step only reads,
 * so many replicas can start at once (FR-032). A failing step logs and exits with code 1 (no retry, FR-036).
 */
export async function runStartupChecks(): Promise<void> {
	// Row 1: reading the configuration throws on a broken config file, X_FILE or regex: value.
	const env = useEnv();

	const logger = useLogger();

	// Rows 2–5 [new]
	logger.info(VERSION_LOG_LINE);
	warnUnsupportedVariables();
	warnSingleInstance();

	// Row 6: the rate limiter modules validate their configuration when loaded (exit 1 when invalid), like Directus.
	await import('../middleware/rate-limiter-global.js');
	await import('../middleware/rate-limiter-ip.js');

	// Rows 7–9: required DB_* variables (validateEnv inside getDatabase), the connection; the MySQL collation
	// check runs without await inside getDatabase, like Directus.
	await validateDatabaseConnection();

	// Row 10
	if ((await isInstalled()) === false) {
		logger.error(`Database doesn't have Directus tables installed.`);
		process.exit(1);
	}

	// Rows 11, 11b, 11c [new]
	await validateMigrations();

	// Rows 12–12c
	if (!env['SECRET']) {
		logger.warn(
			`"SECRET" env variable is missing. Using a random value instead. Tokens will not persist between restarts. This is not appropriate for production usage.`,
		);

		logger.warn('Tokens signed with this random SECRET will not be accepted by Directus.');
	}

	if (typeof env['SECRET'] === 'string' && Buffer.byteLength(env['SECRET']) < 32) {
		logger.warn(
			'"SECRET" env variable is shorter than 32 bytes which is insecure. This is not appropriate for production usage.',
		);
	}

	// Row 13
	if (!new Url(env['PUBLIC_URL'] as string).isAbsolute()) {
		logger.warn('"PUBLIC_URL" should be a full URL');
	}

	// Row 14
	await validateDatabaseExtensions();

	// Row 15 [new], then row 16
	validateStorageDrivers();
	await validateStorage();

	// Row 16b (feature 003, contracts/startup-logs.md): auth providers, like createApp of Directus
	await registerAuthProviders();
}
