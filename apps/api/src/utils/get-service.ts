// Ported from directus/api/src/utils/get-service.ts
// Backoffice: the switch keeps the 23 collections of Directus, in three groups (research R6 of spec 004):
// - the services this app has, imported one by one (Directus imports all of them from services/index.ts);
// - collections whose own service comes with a later feature: a plain ItemsService until then (D-31 of spec 004);
// - any other directus_* collection: ForbiddenError, as in Directus.
import { ForbiddenError } from '@backoffice/errors';
import type { AbstractServiceOptions } from '@backoffice/types';
import { AccessService } from '../services/access.service.js';
import { ActivityService } from '../services/activity.service.js';
import { CommentsService } from '../services/comments.service.js';
import { DashboardsService } from '../services/dashboards.service.js';
import { FilesService } from '../services/files.service.js';
import { FlowsService } from '../services/flows.service.js';
import { FoldersService } from '../services/folders.service.js';
import { ItemsService } from '../services/items.service.js';
import { NotificationsService } from '../services/notifications.service.js';
import { OperationsService } from '../services/operations.service.js';
import { PanelsService } from '../services/panels.service.js';
import { PermissionsService } from '../services/permissions.service.js';
import { PoliciesService } from '../services/policies.service.js';
import { PresetsService } from '../services/presets.service.js';
import { RevisionsService } from '../services/revisions.service.js';
import { RolesService } from '../services/roles.service.js';
import { SharesService } from '../services/shares.service.js';
import { TranslationsService } from '../services/translations.service.js';
import { UsersService } from '../services/users.service.js';
import { VersionsService } from '../services/versions.service.js';

/**
 * Collections that have their own service in Directus 11.17.4 that this app does not port yet (D-31 of spec 004).
 * Remove a collection from this list when the feature that ports its service adds a `case` above the default.
 */
// Features 007 to 010 ported the services and shrank this list (007 removed directus_files and directus_folders; 008
// directus_comments, directus_notifications and directus_versions; 009 directus_flows and directus_operations; 010
// directus_dashboards, directus_panels, directus_settings, directus_shares and directus_translations). The deployment
// module is out of scope (Principle XI, D-17), so its three collections keep a plain ItemsService for good (D-31).
// ponytail: directus_settings leaves the list when SettingsService extends ItemsService (spec 010 T016).
export const COLLECTIONS_WITHOUT_SERVICE_YET = [
	'directus_deployments',
	'directus_deployment_projects',
	'directus_deployment_runs',
	'directus_settings',
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
		case 'directus_comments':
			return new CommentsService(opts);
		case 'directus_dashboards':
			return new DashboardsService(opts);
		case 'directus_files':
			return new FilesService(opts);
		case 'directus_flows':
			return new FlowsService(opts);
		case 'directus_folders':
			return new FoldersService(opts);
		case 'directus_notifications':
			return new NotificationsService(opts);
		case 'directus_operations':
			return new OperationsService(opts);
		case 'directus_panels':
			return new PanelsService(opts);
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
		case 'directus_shares':
			return new SharesService(opts);
		case 'directus_translations':
			return new TranslationsService(opts);
		case 'directus_users':
			return new UsersService(opts);
		case 'directus_versions':
			return new VersionsService(opts);
		default:
			if (COLLECTIONS_WITHOUT_SERVICE_YET.includes(collection)) return new ItemsService(collection, opts);

			// Deny usage of other system collections via ItemsService
			if (collection.startsWith('directus_')) throw new ForbiddenError();

			return new ItemsService(collection, opts);
	}
}
