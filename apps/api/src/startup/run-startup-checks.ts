import { useEnv } from '@backoffice/env';
import { warnSingleInstance } from '../config/warn-single-instance.js';
import { warnUnsupportedVariables } from '../config/warn-unsupported-variables.js';
import { validateDatabaseConnection } from '../database/index.js';
import { useLogger } from '../logger/index.js';
import { VERSION_LOG_LINE } from '../version.js';

/**
 * Startup steps of contracts/startup.md §1, in order, before the server listens. Every step only reads.
 * A failing step logs and exits with code 1 (no retry, FR-036).
 */
export async function runStartupChecks(): Promise<void> {
	// Row 1: reading the configuration throws on a broken config file, X_FILE or regex: value.
	useEnv();

	const logger = useLogger();

	// Rows 2–5 [new]
	logger.info(VERSION_LOG_LINE);
	warnUnsupportedVariables();
	warnSingleInstance();

	// Rows 7–8: required DB_* variables (validateEnv inside getDatabase) and the connection.
	await validateDatabaseConnection();
}
