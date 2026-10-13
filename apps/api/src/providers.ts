import { useEnv } from '@backoffice/env';
import type { Provider } from '@nestjs/common';
import getDatabase from './database/index.js';
import { useLogger } from './logger/index.js';
import { useRedis } from './redis/index.js';
import { AccessService } from './services/access.service.js';
import { ActivityService } from './services/activity.service.js';
import { AssetsService } from './services/assets.service.js';
import { AuthenticationService } from './services/authentication.service.js';
import { CollectionsService } from './services/collections.service.js';
import { CommentsService } from './services/comments.service.js';
import { FieldsService } from './services/fields.service.js';
import { FilesService } from './services/files.service.js';
import { FlowsService } from './services/flows.service.js';
import { FoldersService } from './services/folders.service.js';
import { ItemsService } from './services/items.service.js';
import { MetaService } from './services/meta.service.js';
import { ExportService, ImportService } from './services/import-export.service.js';
import { NotificationsService } from './services/notifications.service.js';
import { UtilsService } from './services/utils.service.js';
import { TranslationsService } from './services/translations.service.js';
import { SharesService } from './services/shares.service.js';
import { ExtensionsService } from './services/extensions.service.js';
import { PresetsService } from './services/presets.service.js';
import { PanelsService } from './services/panels.service.js';
import { DashboardsService } from './services/dashboards.service.js';
import { OperationsService } from './services/operations.service.js';
import { PermissionsService } from './services/permissions.service.js';
import { PoliciesService } from './services/policies.service.js';
import { RelationsService } from './services/relations.service.js';
import { RevisionsService } from './services/revisions.service.js';
import { RolesService } from './services/roles.service.js';
import { SchemaService } from './services/schema.service.js';
import { ServerService } from './services/server.service.js';
import { SettingsService } from './services/settings.service.js';
import { SpecificationService } from './services/specifications.service.js';
import { TFAService } from './services/tfa.service.js';
import { UsersService } from './services/users.service.js';
import { VersionsService } from './services/versions.service.js';

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

/** ItemsService takes the collection first, like `new ItemsService(req.collection, options)` in Directus. */
export type ItemsServiceFactory = (
	collection: string,
	options: Omit<ConstructorParameters<typeof ItemsService>[1], 'knex'>,
) => ItemsService;

export const infrastructureProviders: Provider[] = [
	{ provide: ENV, useValue: useEnv },
	{ provide: LOGGER, useValue: useLogger },
	{ provide: DATABASE, useValue: getDatabase },
	{ provide: REDIS, useValue: useRedis },
];

export const serviceProviders: Provider[] = [
	{
		provide: UtilsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new UtilsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: ImportService,
		useFactory: (db: typeof getDatabase) => (options: any) => new ImportService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: ExportService,
		useFactory: (db: typeof getDatabase) => (options: any) => new ExportService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: TranslationsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new TranslationsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: ExtensionsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new ExtensionsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: SharesService,
		useFactory: (db: typeof getDatabase) => (options: any) => new SharesService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: PresetsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new PresetsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: PanelsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new PanelsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: DashboardsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new DashboardsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: AccessService,
		useFactory: (db: typeof getDatabase) => (options: any) => new AccessService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: ActivityService,
		useFactory: (db: typeof getDatabase) => (options: any) => new ActivityService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: AssetsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new AssetsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: AuthenticationService,
		useFactory: (db: typeof getDatabase) => (options: any) => new AuthenticationService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: CollectionsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new CollectionsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: CommentsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new CommentsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: FieldsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new FieldsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: FilesService,
		useFactory: (db: typeof getDatabase) => (options: any) => new FilesService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: FoldersService,
		useFactory: (db: typeof getDatabase) => (options: any) => new FoldersService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: ItemsService,
		useFactory:
			(db: typeof getDatabase): ItemsServiceFactory =>
			(collection, options) =>
				new ItemsService(collection, { knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: MetaService,
		useFactory: (db: typeof getDatabase) => (options: any) => new MetaService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: FlowsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new FlowsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: NotificationsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new NotificationsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: OperationsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new OperationsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: PermissionsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new PermissionsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: PoliciesService,
		useFactory: (db: typeof getDatabase) => (options: any) => new PoliciesService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: RelationsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new RelationsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: RevisionsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new RevisionsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: RolesService,
		useFactory: (db: typeof getDatabase) => (options: any) => new RolesService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
	{
		provide: SchemaService,
		useFactory: (db: typeof getDatabase) => (options: any) => new SchemaService({ knex: db(), ...options }),
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
		useFactory: (db: typeof getDatabase) => (options: any) => new SettingsService({ knex: db(), ...options }),
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
	{
		provide: VersionsService,
		useFactory: (db: typeof getDatabase) => (options: any) => new VersionsService({ knex: db(), ...options }),
		inject: [DATABASE],
	},
];
