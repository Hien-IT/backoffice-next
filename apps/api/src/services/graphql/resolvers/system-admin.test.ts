// Backoffice (spec 020, T024): the extensions query and update_extensions_item of the system schema call
// ExtensionsService like directus/api/src/services/graphql/resolvers/system-admin.ts:283-327.
import { SchemaComposer } from 'graphql-compose';
import { beforeEach, expect, test, vi } from 'vitest';
import { ExtensionsService } from '../../extensions.service.js';
import { resolveSystemAdmin } from './system-admin.js';

const service = { readAll: vi.fn(), readOne: vi.fn(), updateOne: vi.fn() };

vi.mock('../../extensions.service.js', () => ({
	ExtensionsService: vi.fn(function () {
		return service;
	}),
}));

vi.mock('../index.js', () => ({ GraphQLService: class {} }));
vi.mock('../../collections.service.js', () => ({ CollectionsService: vi.fn() }));
vi.mock('../../relations.service.js', () => ({ RelationsService: vi.fn() }));
vi.mock('../../fields.service.js', () => ({ FieldsService: vi.fn(), systemFieldUpdateSchema: {} }));

const { fakeType } = vi.hoisted(() => ({
	fakeType: (name: string) => (composer: any, _schema: unknown, action: string) =>
		composer.createObjectTC({ name: `${name}_${action}`, fields: { id: 'String' } }),
}));

vi.mock('./get-collection-type.js', () => ({ getCollectionType: fakeType('collection') }));
vi.mock('./get-field-type.js', () => ({ getFieldType: fakeType('field') }));
vi.mock('./get-relation-type.js', () => ({ getRelationType: fakeType('relation') }));

const build = async (admin: boolean) => {
	const composer = new SchemaComposer<any>();
	const gql = { accountability: { admin }, schema: { collections: {} } } as any;
	resolveSystemAdmin(gql, { read: {}, create: {}, update: {}, delete: {} } as any, composer);
	return { composer, gql };
};

beforeEach(() => {
	vi.clearAllMocks();
});

test('extensions reads every extension with the caller accountability', async () => {
	const { composer, gql } = await build(true);
	service.readAll.mockResolvedValue([{ name: 'a' }]);

	await expect(composer.Query.getField('extensions').resolve!({}, {}, {}, {} as any)).resolves.toEqual([{ name: 'a' }]);
	expect(ExtensionsService).toHaveBeenCalledWith({ accountability: gql.accountability, schema: gql.schema });
});

test('update_extensions_item updates, then reads the row back', async () => {
	const { composer } = await build(true);
	service.readOne.mockResolvedValue({ id: 'x', meta: { enabled: false } });

	const result = await composer.Mutation.getField('update_extensions_item').resolve!(
		{},
		{ id: 'x', data: { meta: { enabled: false } } },
		{},
		{} as any,
	);

	expect(service.updateOne).toHaveBeenCalledWith('x', { meta: { enabled: false } });
	expect(result).toEqual({ id: 'x', meta: { enabled: false } });
});

test('nothing for non admins', async () => {
	const { composer } = await build(false);

	expect(composer.Query.hasField('extensions')).toBe(false);
	expect(composer.Mutation.hasField('update_extensions_item')).toBe(false);
});
