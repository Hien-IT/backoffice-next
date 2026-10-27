import { useEnv } from '@backoffice/env';
import { type DynamicModule, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AccessController } from './controllers/access.controller.js';
import { ActivityController } from './controllers/activity.controller.js';
import { AssetsController } from './controllers/assets.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { CollectionsController } from './controllers/collections.controller.js';
import { CommentsController } from './controllers/comments.controller.js';
import { FlowsController } from './controllers/flows.controller.js';
import { FieldsController } from './controllers/fields.controller.js';
import { FilesController } from './controllers/files.controller.js';
import { FoldersController } from './controllers/folders.controller.js';
import { GraphqlController } from './controllers/graphql.controller.js';
import { ItemsController } from './controllers/items.controller.js';
import { OperationsController } from './controllers/operations.controller.js';
import { BackofficePermissionsController } from './controllers/backoffice-permissions.controller.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { PoliciesController } from './controllers/policies.controller.js';
import { RelationsController } from './controllers/relations.controller.js';
import { RevisionsController } from './controllers/revisions.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { SchemaController } from './controllers/schema.controller.js';
import { DashboardsController } from './controllers/dashboards.controller.js';
import { NotificationsController } from './controllers/notifications.controller.js';
import { PanelsController } from './controllers/panels.controller.js';
import { PresetsController } from './controllers/presets.controller.js';
import { TranslationsController } from './controllers/translations.controller.js';
import { SharesController } from './controllers/shares.controller.js';
import { ExtensionsController } from './controllers/extensions.controller.js';
import { ServerController } from './controllers/server.controller.js';
import { SettingsController } from './controllers/settings.controller.js';
import { TusController } from './controllers/tus.controller.js';
import { UtilsController } from './controllers/utils.controller.js';
import { UsersController } from './controllers/users.controller.js';
import { VersionsController } from './controllers/versions.controller.js';
import { ExtensionsModule } from './extensions/extensions.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import useCollection from './middleware/use-collection.js';
import { infrastructureProviders, serviceProviders } from './providers.js';

/** Feature 007: the tus router of DR, mounted only when TUS_ENABLED is true (directus/api/src/app.ts). */
@Module({ controllers: [TusController] })
export class TusModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(useCollection('directus_files')).forRoutes(TusController);
	}
}

@Module({
	imports: [MetricsModule, ExtensionsModule],
	controllers: [
		AccessController,
		ActivityController,
		AssetsController,
		AuthController,
		CollectionsController,
		CommentsController,
		FieldsController,
		FilesController,
		FlowsController,
		FoldersController,
		GraphqlController,
		ItemsController,
		OperationsController,
		PermissionsController,
		// Backoffice (spec 025, D-189.6).
		BackofficePermissionsController,
		PoliciesController,
		RelationsController,
		RevisionsController,
		RolesController,
		SchemaController,
		DashboardsController,
		NotificationsController,
		PanelsController,
		PresetsController,
		TranslationsController,
		ServerController,
		SharesController,
		ExtensionsController,
		SettingsController,
		UsersController,
		UtilsController,
		VersionsController,
	],
	providers: [...infrastructureProviders, ...serviceProviders],
})
export class AppModule implements NestModule {
	/** The module with the routes that depend on the configuration, read when the app is created (not at import). */
	static forRoot(): DynamicModule {
		return { module: AppModule, imports: useEnv()['TUS_ENABLED'] === true ? [TusModule] : [] };
	}

	// `router.use(useCollection(...))` of each DR router.
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(useCollection('directus_access')).forRoutes(AccessController);
		consumer.apply(useCollection('directus_comments')).forRoutes(CommentsController);
		consumer.apply(useCollection('directus_activity')).forRoutes(ActivityController);
		consumer.apply(useCollection('directus_files')).forRoutes(AssetsController, FilesController);
		consumer.apply(useCollection('directus_fields')).forRoutes(FieldsController);
		consumer.apply(useCollection('directus_flows')).forRoutes(FlowsController);
		consumer.apply(useCollection('directus_folders')).forRoutes(FoldersController);
		consumer.apply(useCollection('directus_operations')).forRoutes(OperationsController);
		consumer.apply(useCollection('directus_permissions')).forRoutes(PermissionsController);
		consumer.apply(useCollection('backoffice_permissions')).forRoutes(BackofficePermissionsController);
		consumer.apply(useCollection('directus_policies')).forRoutes(PoliciesController);
		consumer.apply(useCollection('directus_relations')).forRoutes(RelationsController);
		consumer.apply(useCollection('directus_revisions')).forRoutes(RevisionsController);
		consumer.apply(useCollection('directus_roles')).forRoutes(RolesController);
		consumer.apply(useCollection('directus_dashboards')).forRoutes(DashboardsController);
		consumer.apply(useCollection('directus_notifications')).forRoutes(NotificationsController);
		consumer.apply(useCollection('directus_panels')).forRoutes(PanelsController);
		consumer.apply(useCollection('directus_presets')).forRoutes(PresetsController);
		consumer.apply(useCollection('directus_translations')).forRoutes(TranslationsController);
		consumer.apply(useCollection('directus_shares')).forRoutes(SharesController);
		consumer.apply(useCollection('directus_extensions')).forRoutes(ExtensionsController);
		consumer.apply(useCollection('directus_settings')).forRoutes(SettingsController);
		consumer.apply(useCollection('directus_users')).forRoutes(UsersController);
		consumer.apply(useCollection('directus_versions')).forRoutes(VersionsController);
	}
}
