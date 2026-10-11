// Ported from directus/api/src/utils/get-service.ts
// Backoffice: the switch keeps the 23 collections of Directus, in three groups (research R6 of spec 004):
// - the services this app has, imported one by one (Directus imports all of them from services/index.ts);
// - collections whose own service comes with a later feature: a plain ItemsService until then (D-31 of spec 004);
// - any other directus_* collection: ForbiddenError, as in Directus.
import { ForbiddenError } from '@backoffice/errors';
import type { AbstractServiceOptions } from '@backoffice/types';
import { AccessService } from '../services/access.service.js';
import { ActivityService } from '../services/activity.service.js';
import { ItemsService } from '../services/items.service.js';
import { PermissionsService } from '../services/permissions.service.js';
import { PoliciesService } from '../services/policies.service.js';
import { PresetsService } from '../services/presets.service.js';
import { RevisionsService } from '../services/revisions.service.js';
import { RolesService } from '../services/roles.service.js';
import { UsersService } from '../services/users.service.js';

/**
 * Collections that have their own service in Directus 11.17.4 that this app does not port yet (D-31 of spec 004).
 * Remove a collection from this list when the feature that ports its service adds a `case` above the default.
 */
// ponytail: plain ItemsService for these collections skips the checks of their own service; features 007 to 010
// port the services and shrink this list.
export const COLLECTIONS_WITHOUT_SERVICE_YET = [
	'directus_comments',
	'directus_dashboards',
	'directus_deployments',
	'directus_deployment_projects',
	'directus_deployment_runs',
	'directus_files',
	'directus_flows',
	'directus_folders',
	'directus_notifications',
	'directus_operations',
	'directus_panels',
	'directus_settings',
	'directus_shares',
	'directus_translations',
	'directus_versions',
];

/**
 * Select the correct service for the given collection. This allows the individual services to run
 * their custom checks (f.e. it allows `UsersService` to prevent updating TFA secret from outside).
 */
export function getService(collection: string, opts: AbstractServiceOptions): ItemsService {
	switch (collection) {
		case 'directus_access':
			return new AccessService(opts);
		case 'directus_activity':
			return new ActivityService(opts);
		case 'directus_permissions':
			return new PermissionsService(opts);
		case 'directus_presets':
			return new PresetsService(opts);
		case 'directus_policies':
			return new PoliciesService(opts);
		case 'directus_revisions':
			return new RevisionsService(opts);
		case 'directus_roles':
			return new RolesService(opts);
		case 'directus_users':
			return new UsersService(opts);
		default:
			if (COLLECTIONS_WITHOUT_SERVICE_YET.includes(collection)) return new ItemsService(collection, opts);

			// Deny usage of other system collections via ItemsService
			if (collection.startsWith('directus_')) throw new ForbiddenError();

			return new ItemsService(collection, opts);
	}
}
