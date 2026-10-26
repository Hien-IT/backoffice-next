// Rewrite of validateMigrations from directus/api/src/database/index.ts (FR-031, FR-035, FR-036, D-05, D-06):
// missing AND unknown versions stop the API; custom migrations are accepted from the two folders DR uses. The
// Backoffice migrations (spec 022 FR-016, D-180) are checked the same way against backoffice_migrations.
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { useEnv } from '@backoffice/env';
import type { Knex } from 'knex';
import { DIRECTUS_COMPAT_VERSION } from '../constants.js';
import { getExtensionsPath } from '../extensions/lib/get-extensions-path.js';
import { useLogger } from '../logger/index.js';
import { BACKOFFICE_MIGRATIONS, completedBackofficeMigrations } from './backoffice-migrations/index.js';
import getDatabase from './index.js';
import { DIRECTUS_MIGRATIONS } from './migrations/directus-11.17.4.js';

export interface CustomMigration {
	version: string;
	directory: string;
}

export interface MigrationCheck {
	required: string[];
	custom: CustomMigration[];
	completed: string[];
	missing: string[];
	extra: string[];
	boRequired: string[];
	boCompleted: string[];
	boMissing: string[];
	boExtra: string[];
}

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

function readNames(directory: string): string[] {
	// Only file names are read: migration files are never opened or imported.
	return existsSync(directory) ? readdirSync(directory) : [];
}

/**
 * Custom migration versions, like DR finds them:
 * - MIGRATIONS_PATH (where `directus database migrate` runs them): names with "-" ending in .js/.cjs/.mjs
 * - <EXTENSIONS_PATH>/migrations (where DR' startup check looks): every .js file
 * The version is the part before the first "-" (the whole file name when there is none).
 * A version found in both folders is reported with MIGRATIONS_PATH.
 */
export function getCustomMigrations(): CustomMigration[] {
	const env = useEnv();
	const migrationsPath = resolve(env['MIGRATIONS_PATH'] as string);
	const extensionsPath = resolve(getExtensionsPath(), 'migrations');
	const found = new Map<string, string>();

	for (const file of readNames(migrationsPath).filter((f) => f.includes('-') && /\.(c|m)?js$/.test(f))) {
		if (!found.has(file.split('-')[0]!)) found.set(file.split('-')[0]!, migrationsPath);
	}

	for (const file of readNames(extensionsPath).filter((f) => f.endsWith('.js'))) {
		if (!found.has(file.split('-')[0]!)) found.set(file.split('-')[0]!, extensionsPath);
	}

	return [...found.entries()]
		.map(([version, directory]) => ({ version, directory }))
		.sort((a, b) => (a.version > b.version ? 1 : -1));
}

export async function checkMigrations(database: Knex = getDatabase()): Promise<MigrationCheck> {
	const custom = getCustomMigrations();
	const required = sorted([...DIRECTUS_MIGRATIONS, ...custom.map((m) => m.version)]);
	const completed = sorted(
		(await database.select('version').from('directus_migrations')).map(({ version }) => String(version)),
	);

	const completedSet = new Set(completed);
	const requiredSet = new Set(required);

	const boRequired = BACKOFFICE_MIGRATIONS.map((m) => m.version);
	const boCompleted = sorted(await completedBackofficeMigrations(database));
	const boCompletedSet = new Set(boCompleted);
	const boRequiredSet = new Set(boRequired);

	return {
		required,
		custom,
		completed,
		missing: required.filter((v) => !completedSet.has(v)),
		extra: completed.filter((v) => !requiredSet.has(v)),
		boRequired,
		boCompleted,
		boMissing: boRequired.filter((v) => !boCompletedSet.has(v)),
		boExtra: boCompleted.filter((v) => !boRequiredSet.has(v)),
	};
}

/**
 * The boolean check of DR' validateMigrations (database/index.ts), used by the CLI before it loads extensions
 * (spec 021 FR-043): true when no required migration is missing; unknown versions do not count, as in DR. A
 * failing read logs and exits with code 1, as DR does.
 */
export async function migrationsValid(database: Knex = getDatabase()): Promise<boolean> {
	try {
		const result = await checkMigrations(database);
		return result.missing.length === 0 && result.boMissing.length === 0;
	} catch (error: any) {
		const logger = useLogger();
		logger.error(`Database migrations cannot be found`);
		logger.error(error);
		throw process.exit(1);
	}
}

/** Exits with code 1 when directus_migrations does not match; never waits nor retries (FR-036). */
export async function validateMigrations(database?: Knex): Promise<void> {
	const logger = useLogger();
	let result: MigrationCheck;

	try {
		result = await checkMigrations(database);
	} catch (error: any) {
		logger.error(`Database migrations cannot be found`);
		logger.error(error);
		throw process.exit(1);
	}

	if (result.custom.length > 0) {
		logger.warn(
			`Custom migrations are accepted: ${result.custom.map((m) => `${m.version} (${m.directory})`).join(', ')}`,
		);
	}

	const directusOk = result.missing.length === 0 && result.extra.length === 0;
	const backofficeOk = result.boMissing.length === 0 && result.boExtra.length === 0;

	if (directusOk && backofficeOk) return;

	if (!directusOk) {
		logger.error(`Database migrations do not match Directus ${DIRECTUS_COMPAT_VERSION}.`);
		if (result.missing.length > 0) logger.error(`Missing migrations (not run yet): ${result.missing.join(', ')}`);
		if (result.extra.length > 0)
			logger.error(`Unknown migrations (not part of Directus ${DIRECTUS_COMPAT_VERSION}): ${result.extra.join(', ')}`);
		logger.error(`If Directus is still migrating, restart Backoffice after it finishes.`);
	}

	if (!backofficeOk) {
		logger.error('Backoffice migrations do not match.');
		if (result.boMissing.length > 0)
			logger.error(`Missing Backoffice migrations (not run yet): ${result.boMissing.join(', ')}`);
		if (result.boExtra.length > 0)
			logger.error(`Unknown Backoffice migrations (newer Backoffice?): ${result.boExtra.join(', ')}`);
		logger.error('Run "node cli.js bootstrap" to apply them.');
	}

	process.exit(1);
}
