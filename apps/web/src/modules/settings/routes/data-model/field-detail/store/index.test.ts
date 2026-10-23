// Ported from directus/app/src/modules/settings/routes/data-model/field-detail/store/index.test.ts
// Backoffice: createPinia + vi.spyOn on the store functions instead of @pinia/testing (not a dependency); the SDK is
// mocked instead of the DR api module; no crypto stub (node has crypto.getRandomValues).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExtension } from '../../../../../../composables/use-extension.ts';
import { useFieldsStore } from '../../../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../../../stores/relations.ts';
import { setLocalTypeForInterface } from './alterations/global.ts';
import { useFieldDetailStore } from './index.ts';
import type { StateUpdates } from './types.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

vi.mock('../../../../../../api/sdk.ts', () => {
	return {
		requestEndpoint: (path: string) => path,
		sdk: {
			request: (path: string) => {
				// stub for `/fields/:collection/:field` route
				if (/^\/fields\/.+\/.+$/.test(path)) return Promise.resolve({});

				return Promise.reject(new Error(`Path "${path}" is not mocked in this test`));
			},
		},
	};
});

// Mock the useExtension composable
vi.mock('../../../../../../composables/use-extension.ts');

describe('Actions', () => {
	describe('startEditing', () => {
		it('New Field', () => {
			const fieldDetailStore = useFieldDetailStore();

			const testValue: { collection: string; field: string; localType: 'presentation' } = {
				collection: 'collection_a',
				field: '+',
				localType: 'presentation',
			};

			fieldDetailStore.startEditing(testValue.collection, testValue.field, testValue.localType);
			expect(fieldDetailStore.collection).toEqual(testValue.collection);
			expect(fieldDetailStore.field.collection).toEqual(testValue.collection);
			expect(fieldDetailStore.editing).toEqual(testValue.field);
			expect(fieldDetailStore.localType).toEqual(testValue.localType);
		});

		it('Existing Field — M2O', () => {
			const mockedField = {
				collection: 'collection_a',
				field: 'collection_a_field',
				type: 'alias',
				meta: {
					collection: 'collection_a',
					field: 'collection_a_field',
				},
				name: 'Collection A Field',
			};

			const fieldsStore = useFieldsStore();
			vi.spyOn(fieldsStore, 'getField').mockReturnValue(mockedField as never);

			const mockedRelations = [
				{
					collection: 'collection_a',
					field: 'collection_a_field',
					related_collection: 'collection_b',
					meta: {
						many_collection: 'collection_a',
						many_field: 'collection_a_field',
						one_collection: 'collection_b',
						one_field: null,
						one_collection_field: null,
						one_allowed_collections: null,
						junction_field: null,
						sort_field: null,
						one_deselect_action: 'nullify',
					},
				},
			];

			const relationsStore = useRelationsStore();
			vi.spyOn(relationsStore, 'getRelationsForField').mockReturnValue(mockedRelations as never);

			const fieldDetailStore = useFieldDetailStore();
			fieldDetailStore.startEditing(mockedField.collection, mockedField.field);
			expect(fieldDetailStore.collection).toEqual(mockedField.collection);
			expect(fieldDetailStore.field.collection).toEqual(mockedField.collection);
			expect(fieldDetailStore.editing).toEqual(mockedField.field);
			expect(fieldDetailStore.field.name).toEqual(mockedField.name);
			expect(fieldDetailStore.localType).toEqual('m2o');
			expect(fieldDetailStore.relations.o2m).toEqual(undefined);

			expect(fieldDetailStore.relations.m2o).toEqual(
				mockedRelations.find(
					(relation) => relation.collection === mockedField.collection && relation.field === mockedField.field,
				),
			);
		});
	});

	it.todo('Existing Field — M2M');
});

describe('Alterations', () => {
	describe('files', () => {
		it('autoGenerateJunctionRelation has changed', () => {
			const fieldDetailStore = useFieldDetailStore();

			const testValue: { collection: string; field: string; localType: 'files' } = {
				collection: 'collection_a',
				field: '+',
				localType: 'files',
			};

			fieldDetailStore.startEditing(testValue.collection, testValue.field, testValue.localType);

			const fieldsStore = useFieldsStore();

			vi.spyOn(fieldsStore, 'getPrimaryKeyFieldForCollection').mockReturnValue({
				collection: 'collection_a',
				field: 'id',
			} as never);

			expect(fieldDetailStore.collection).toEqual(testValue.collection);
			expect(fieldDetailStore.field.collection).toEqual(testValue.collection);
			expect(fieldDetailStore.editing).toEqual(testValue.field);
			expect(fieldDetailStore.relations.o2m?.collection).toEqual('collection_a_files');
			expect(fieldDetailStore.relations.o2m?.field).toEqual('collection_a_id');
			expect(fieldDetailStore.relations.m2o?.related_collection).toEqual('directus_files');
			expect(fieldDetailStore.relations.m2o?.field).toEqual('directus_files_id');

			fieldDetailStore.update({ autoGenerateJunctionRelation: false });

			fieldDetailStore.update({
				relations: {
					o2m: {
						collection: 'custom_files',
					},
				},
			});

			fieldDetailStore.update({ autoGenerateJunctionRelation: true });

			expect(fieldDetailStore.relations.o2m?.collection).toEqual('collection_a_files');
			expect(fieldDetailStore.relations.o2m?.field).toEqual('collection_a_id');
			expect(fieldDetailStore.relations.m2o?.related_collection).toEqual('directus_files');
			expect(fieldDetailStore.relations.m2o?.field).toEqual('directus_files_id');
		});
	});

	describe('setLocalTypeForInterface', () => {
		beforeEach(() => {
			vi.mocked(useExtension).mockClear();
		});

		it('should preserve current localType when compatible with interface', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			// Mock interface that supports both m2o and o2m
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: ['m2o', 'o2m'],
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should preserve o2m since it's compatible with the interface
			expect(updates.localType).toBe('o2m');
		});

		it('should fall back to first supported localType when current type is incompatible', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with standard localType
			fieldDetailStore.startEditing('test_collection', '+', 'standard');
			expect(fieldDetailStore.localType).toBe('standard');

			// Mock interface that only supports m2o and o2m
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: ['m2o', 'o2m'],
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should fall back to first supported type (m2o) since standard is not compatible
			expect(updates.localType).toBe('m2o');
		});

		it('should handle interface with no localTypes defined', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			// Mock interface with no localTypes
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: undefined,
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should fall back to 'standard' since o2m is not in default ['standard']
			expect(updates.localType).toBe('standard');
		});

		it('should handle interface with empty localTypes array', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			// Mock interface with empty localTypes array
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: [],
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should fall back to 'standard' since empty array falls back to default
			expect(updates.localType).toBe('standard');
		});

		it('should handle interface that returns null/undefined', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			// Mock interface that returns null
			vi.mocked(useExtension).mockReturnValue({
				value: null,
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should not modify updates when interface is null
			expect(updates.localType).toBeUndefined();
		});

		it('should handle updates without interface field', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			const updates: StateUpdates = {
				field: {
					meta: {
						// No interface specified
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should not modify updates when no interface is specified
			expect(updates.localType).toBeUndefined();
		});

		it('should handle updates without field.meta', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			const updates: StateUpdates = {
				field: {
					// No meta specified
				},
			};

			setLocalTypeForInterface(updates);

			// Should not modify updates when no meta is specified
			expect(updates.localType).toBeUndefined();
		});

		it('should handle updates without field', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			const updates: StateUpdates = {
				// No field specified
			};

			setLocalTypeForInterface(updates);

			// Should not modify updates when no field is specified
			expect(updates.localType).toBeUndefined();
		});

		it('should preserve m2o when interface supports m2o and o2m', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with m2o localType
			fieldDetailStore.startEditing('test_collection', '+', 'm2o');
			expect(fieldDetailStore.localType).toBe('m2o');

			// Mock interface that supports both m2o and o2m
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: ['m2o', 'o2m'],
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should preserve m2o since it's compatible with the interface
			expect(updates.localType).toBe('m2o');
		});

		it('should handle interface with single localType', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with o2m localType
			fieldDetailStore.startEditing('test_collection', '+', 'o2m');
			expect(fieldDetailStore.localType).toBe('o2m');

			// Mock interface that only supports m2o
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: ['m2o'],
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should fall back to m2o since o2m is not compatible
			expect(updates.localType).toBe('m2o');
		});

		it('should handle interface with standard localType', () => {
			const fieldDetailStore = useFieldDetailStore();

			// Set up the store with standard localType
			fieldDetailStore.startEditing('test_collection', '+', 'standard');
			expect(fieldDetailStore.localType).toBe('standard');

			// Mock interface that supports standard
			vi.mocked(useExtension).mockReturnValue({
				value: {
					localTypes: ['standard'],
				},
			} as never);

			const updates: StateUpdates = {
				field: {
					meta: {
						interface: 'demo-interface',
					},
				},
			};

			setLocalTypeForInterface(updates);

			// Should preserve standard since it's compatible
			expect(updates.localType).toBe('standard');
		});
	});
});
