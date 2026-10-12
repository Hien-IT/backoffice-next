// getService (task T028, research R6 of spec 004): own services, plain ItemsService for collections whose service comes
// later (D-31), ForbiddenError for other system collections, ItemsService for user collections.
import { SchemaBuilder } from '@backoffice/schema-builder';
import { describe, expect, test, vi } from 'vitest';
import { AccessService } from '../services/access.service.js';
import { ActivityService } from '../services/activity.service.js';
import { FilesService } from '../services/files.service.js';
import { FoldersService } from '../services/folders.service.js';
import { ItemsService } from '../services/items.service.js';
import { PermissionsService } from '../services/permissions.service.js';
import { PoliciesService } from '../services/policies.service.js';
import { PresetsService } from '../services/presets.service.js';
import { RevisionsService } from '../services/revisions.service.js';
import { RolesService } from '../services/roles.service.js';
import { UsersService } from '../services/users.service.js';
import { COLLECTIONS_WITHOUT_SERVICE_YET, getService } from './get-service.js';

vi.mock('../database/index.js', () => ({ default: vi.fn(() => ({})), getDatabaseClient: vi.fn(() => 'postgres') }));

const opts = { schema: new SchemaBuilder().collection('articles', (c) => c.field('id').id()).build(), knex: {} as any };

describe('getService', () => {
	test.each([
		['directus_access', AccessService],
		['directus_activity', ActivityService],
		['directus_files', FilesService],
		['directus_folders', FoldersService],
		['directus_permissions', PermissionsService],
		['directus_policies', PoliciesService],
		['directus_presets', PresetsService],
		['directus_revisions', RevisionsService],
		['directus_roles', RolesService],
		['directus_users', UsersService],
	])('%s has its own service', (collection, Service) => {
		expect(getService(collection, opts)).toBeInstanceOf(Service);
	});

	test.each(COLLECTIONS_WITHOUT_SERVICE_YET)('%s gets a plain ItemsService until its feature (D-31)', (collection) => {
		const service = getService(collection, opts);
		expect(service.constructor).toBe(ItemsService);
		expect(service.collection).toBe(collection);
	});

	test.each([
		'directus_sessions',
		'directus_migrations',
		'directus_fields',
		'directus_collections',
		'directus_relations',
	])('%s is forbidden, as in Directus', (collection) => {
		expect(() => getService(collection, opts)).toThrow("You don't have permission to access this.");
	});

	test('a user collection gets a plain ItemsService', () => {
		expect(getService('articles', opts).constructor).toBe(ItemsService);
	});
});
