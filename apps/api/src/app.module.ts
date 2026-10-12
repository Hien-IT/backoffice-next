import { useEnv } from '@backoffice/env';
import { type DynamicModule, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AccessController } from './controllers/access.controller.js';
import { AssetsController } from './controllers/assets.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { CollectionsController } from './controllers/collections.controller.js';
import { FieldsController } from './controllers/fields.controller.js';
import { FilesController } from './controllers/files.controller.js';
import { FoldersController } from './controllers/folders.controller.js';
import { ItemsController } from './controllers/items.controller.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { PoliciesController } from './controllers/policies.controller.js';
import { RelationsController } from './controllers/relations.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { SchemaController } from './controllers/schema.controller.js';
import { ServerController } from './controllers/server.controller.js';
import { TusController } from './controllers/tus.controller.js';
import { UsersController } from './controllers/users.controller.js';
import { MetricsModule } from './metrics/metrics.module.js';
import useCollection from './middleware/use-collection.js';
import { infrastructureProviders, serviceProviders } from './providers.js';

/** Feature 007: the tus router of Directus, mounted only when TUS_ENABLED is true (directus/api/src/app.ts). */
@Module({ controllers: [TusController] })
export class TusModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(useCollection('directus_files')).forRoutes(TusController);
	}
}

@Module({
	imports: [MetricsModule],
	controllers: [
		AccessController,
		AssetsController,
		AuthController,
		CollectionsController,
		FieldsController,
		FilesController,
		FoldersController,
		ItemsController,
		PermissionsController,
		PoliciesController,
		RelationsController,
		RolesController,
		SchemaController,
		ServerController,
		UsersController,
	],
	providers: [...infrastructureProviders, ...serviceProviders],
})
export class AppModule implements NestModule {
	/** The module with the routes that depend on the configuration, read when the app is created (not at import). */
	static forRoot(): DynamicModule {
		return { module: AppModule, imports: useEnv()['TUS_ENABLED'] === true ? [TusModule] : [] };
	}

	// `router.use(useCollection(...))` of each Directus router.
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(useCollection('directus_access')).forRoutes(AccessController);
		consumer.apply(useCollection('directus_files')).forRoutes(AssetsController, FilesController);
		consumer.apply(useCollection('directus_fields')).forRoutes(FieldsController);
		consumer.apply(useCollection('directus_folders')).forRoutes(FoldersController);
		consumer.apply(useCollection('directus_permissions')).forRoutes(PermissionsController);
		consumer.apply(useCollection('directus_policies')).forRoutes(PoliciesController);
		consumer.apply(useCollection('directus_relations')).forRoutes(RelationsController);
		consumer.apply(useCollection('directus_roles')).forRoutes(RolesController);
		consumer.apply(useCollection('directus_users')).forRoutes(UsersController);
	}
}
