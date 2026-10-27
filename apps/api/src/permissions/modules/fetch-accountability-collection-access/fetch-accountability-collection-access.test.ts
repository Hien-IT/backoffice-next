// Ported from directus/api/src/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.test.ts
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { Accountability, Permission } from '@backoffice/types';
import { beforeEach, expect, test, vi } from 'vitest';
import { fetchPermissions } from '../../lib/fetch-permissions.js';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';
import { fetchBackofficePermissions } from '../backoffice-permissions/fetch-backoffice-permissions.js';
import { fetchAccountabilityCollectionAccess } from './fetch-accountability-collection-access.js';

vi.mock('../../lib/fetch-policies.js');
vi.mock('../../lib/fetch-permissions.js');
// Backoffice (spec 025): the rows of backoffice_permissions.
vi.mock('../backoffice-permissions/fetch-backoffice-permissions.js', () => ({
	fetchBackofficePermissions: vi.fn(async () => []),
}));

beforeEach(() => {
	vi.clearAllMocks();

	vi.mocked(fetchPolicies).mockResolvedValue([]);
});

test('Returns all permissions for all collections if admin', async () => {
	const schema = new SchemaBuilder()
		.collection('collection-a', (c) => {
			c.field('id').id();
		})
		.collection('collection-b', (c) => {
			c.field('id').id();
		})
		.build();

	const result = await fetchAccountabilityCollectionAccess(
		{ admin: true } as unknown as Accountability,
		{ schema } as unknown as Context,
	);

	expect(result).toEqual({
		'collection-a': {
			create: { access: 'full', fields: ['*'] },
			read: { access: 'full', fields: ['*'] },
			update: { access: 'full', fields: ['*'] },
			delete: { access: 'full', fields: ['*'] },
			share: { access: 'full', fields: ['*'] },
			import: { access: 'full', fields: ['*'], formats: ['csv', 'json'] },
			export: { access: 'full', fields: ['*'], formats: ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] },
		},
		'collection-b': {
			create: { access: 'full', fields: ['*'] },
			read: { access: 'full', fields: ['*'] },
			update: { access: 'full', fields: ['*'] },
			delete: { access: 'full', fields: ['*'] },
			share: { access: 'full', fields: ['*'] },
			import: { access: 'full', fields: ['*'], formats: ['csv', 'json'] },
			export: { access: 'full', fields: ['*'], formats: ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] },
		},
	});
});

test('Returns permissions for collections for accountability if not admin', async () => {
	const permissions = [
		{ collection: 'collection-a', action: 'read', fields: ['field-a', 'field-b'] },
		{ collection: 'collection-b', action: 'update', fields: ['field-c'], permissions: {} },
	] as unknown as Permission[];

	vi.mocked(fetchPermissions).mockResolvedValue(permissions);

	const result = await fetchAccountabilityCollectionAccess({} as unknown as Accountability, {} as unknown as Context);

	expect(result).toEqual({
		'collection-a': {
			create: { access: 'none' },
			read: { access: 'full', fields: ['field-a', 'field-b'] },
			update: { access: 'none' },
			delete: { access: 'none' },
			share: { access: 'none' },
			import: { access: 'none' },
			export: { access: 'none' },
		},
		'collection-b': {
			create: { access: 'none' },
			read: { access: 'none' },
			update: { access: 'full', fields: ['field-c'] },
			delete: { access: 'none' },
			share: { access: 'none' },
			import: { access: 'none' },
			export: { access: 'none' },
		},
	});
});

test('Returns permissions with partial access if permissions have filters', async () => {
	const permissions = [
		{
			collection: 'collection-a',
			action: 'read',
			fields: ['field-a', 'field-b'],
			permissions: {
				'field-a': {},
			},
		},
	] as unknown as Permission[];

	vi.mocked(fetchPermissions).mockResolvedValue(permissions);

	const result = await fetchAccountabilityCollectionAccess({} as unknown as Accountability, {} as unknown as Context);

	expect(result).toEqual({
		'collection-a': {
			create: { access: 'none' },
			read: {
				access: 'partial',
				fields: ['field-a', 'field-b'],
			},
			update: { access: 'none' },
			delete: { access: 'none' },
			share: { access: 'none' },
			import: { access: 'none' },
			export: { access: 'none' },
		},
	});
});

test('Returns fields with * if any permission has *', async () => {
	const permissions = [
		{ collection: 'collection-a', action: 'read', fields: ['field-a', 'field-b'] },
		{ collection: 'collection-a', action: 'read', fields: ['*'] },
	] as unknown as Permission[];

	vi.mocked(fetchPermissions).mockResolvedValue(permissions);

	const result = await fetchAccountabilityCollectionAccess({} as unknown as Accountability, {} as unknown as Context);

	expect(result).toEqual({
		'collection-a': {
			create: { access: 'none' },
			read: { access: 'full', fields: ['*'] },
			update: { access: 'none' },
			delete: { access: 'none' },
			share: { access: 'none' },
			import: { access: 'none' },
			export: { access: 'none' },
		},
	});
});

test('Returns combined presets', async () => {
	const permissions = [
		{
			collection: 'collection-a',
			action: 'read',
			fields: ['field-a', 'field-b'],
			presets: { 'field-a': 1, 'field-b': 2 },
		},
		{ collection: 'collection-a', action: 'read', fields: ['*'], presets: { 'field-a': 3, 'field-c': 4 } },
	] as unknown as Permission[];

	vi.mocked(fetchPermissions).mockResolvedValue(permissions);

	const result = await fetchAccountabilityCollectionAccess({} as unknown as Accountability, {} as unknown as Context);

	expect(result).toEqual({
		'collection-a': {
			create: { access: 'none' },
			read: { access: 'full', fields: ['*'], presets: { 'field-a': 3, 'field-b': 2, 'field-c': 4 } },
			update: { access: 'none' },
			delete: { access: 'none' },
			share: { access: 'none' },
			import: { access: 'none' },
			export: { access: 'none' },
		},
	});
});

// Backoffice (spec 025, FR-018, D-189): import and export from backoffice_permissions.
test('import and export of the collections listed: none, full or partial, fields and formats added up', async () => {
	vi.mocked(fetchPolicies).mockResolvedValue(['p1']);
	vi.mocked(fetchPermissions).mockResolvedValue([
		{ collection: 'collection-a', action: 'read', fields: ['*'] },
	] as unknown as Permission[]);
	vi.mocked(fetchBackofficePermissions).mockResolvedValue([
		{
			policy: 'p1',
			collection: 'collection-a',
			action: 'export',
			permissions: { id: { _gt: 1 } },
			validation: null,
			presets: null,
			fields: ['id'],
			options: { formats: ['csv'] },
		},
		{
			policy: 'p1',
			collection: 'collection-a',
			action: 'export',
			permissions: { id: { _lt: 9 } },
			validation: null,
			presets: null,
			fields: ['title'],
			options: null,
		},
		// Only in the new table: left out like DR leaves out a collection without rows (analyze U1).
		{
			policy: 'p1',
			collection: 'collection-b',
			action: 'import',
			permissions: null,
			validation: null,
			presets: null,
			fields: null,
			options: null,
		},
	]);

	const result = await fetchAccountabilityCollectionAccess({} as unknown as Accountability, {} as unknown as Context);

	expect(result['collection-a']).toMatchObject({
		read: { access: 'full', fields: ['*'] },
		import: { access: 'none' },
		export: { access: 'partial', fields: ['id', 'title'], formats: ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] },
	});
	expect(result['collection-b']).toBeUndefined();
	expect(fetchBackofficePermissions).toHaveBeenCalledWith({ policies: ['p1'] }, {});
});
