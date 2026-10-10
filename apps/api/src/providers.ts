import { useEnv } from '@backoffice/env';
import type { Provider } from '@nestjs/common';
import getDatabase from './database/index.js';
import { useLogger } from './logger/index.js';
import { useRedis } from './redis/index.js';
import { AuthenticationService } from './services/authentication.service.js';
import { ServerService } from './services/server.service.js';
import { SettingsService } from './services/settings.service.js';
import { SpecificationService } from './services/specifications.service.js';
import { TFAService } from './services/tfa.service.js';
import { UsersService } from './services/users.service.js';

/**
 * Infrastructure written as shared functions in Directus (useEnv, useLogger, getDatabase, useRedis) stays a
 * function, close to the ported code, and is exposed to Nest as providers (plan.md Constitution Check VI).
 */
// Each token resolves to the accessor function, not its result: like in Directus, the configuration, the logger,
// the knex instance and the Redis client are only created when first used (never while Nest boots).
export const ENV = Symbol('ENV');
export const LOGGER = Symbol('LOGGER');
export const DATABASE = Symbol('DATABASE');
export const REDIS = Symbol('REDIS');

/** Directus creates its services per request with the request accountability and schema; so do these factories. */
export type ServiceFactory<T, O = ConstructorParameters<new (...args: any[]) => T>[0]> = (options?: O) => T;

export const infrastructureProviders: Provider[] = [
	{ provide: ENV, useValue: useEnv },
	{ provide: LOGGER, useValue: useLogger },
	{ provide: DATABASE, useValue: getDatabase },
	{ provide: REDIS, useValue: useRedis },
];

export const serviceProviders: Provider[] = [
	{
		provide: AuthenticationService,
		useFactory: (db: typeof getDatabase) => (options: any) => new AuthenticationService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: ServerService,
		useFactory:
			(db: typeof getDatabase) =>
			(options = {}) =>
				new ServerService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: SettingsService,
		useFactory:
			(db: typeof getDatabase) =>
			(options = {}) =>
				new SettingsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: SpecificationService,
		useFactory: (db: typeof getDatabase) => (options: any) => new SpecificationService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: TFAService,
		useFactory: (db: typeof getDatabase) => (options: any) => new TFAService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: UsersService,
		useFactory: (db: typeof getDatabase) => (options: any) => new UsersService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
];
