import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AccessController } from './controllers/access.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { ItemsController } from './controllers/items.controller.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { PoliciesController } from './controllers/policies.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { ServerController } from './controllers/server.controller.js';
import { UsersController } from './controllers/users.controller.js';
import { MetricsModule } from './metrics/metrics.module.js';
import useCollection from './middleware/use-collection.js';
import { infrastructureProviders, serviceProviders } from './providers.js';

@Module({
	imports: [MetricsModule],
	controllers: [
		AccessController,
		AuthController,
		ItemsController,
		PermissionsController,
		PoliciesController,
		RolesController,
		ServerController,
		UsersController,
	],
	providers: [...infrastructureProviders, ...serviceProviders],
})
export class AppModule implements NestModule {
	// `router.use(useCollection(...))` of each Directus router.
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(useCollection('directus_access')).forRoutes(AccessController);
		consumer.apply(useCollection('directus_permissions')).forRoutes(PermissionsController);
		consumer.apply(useCollection('directus_policies')).forRoutes(PoliciesController);
		consumer.apply(useCollection('directus_roles')).forRoutes(RolesController);
		consumer.apply(useCollection('directus_users')).forRoutes(UsersController);
	}
}
