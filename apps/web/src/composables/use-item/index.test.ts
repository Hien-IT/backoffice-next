// Ported from directus/app/src/composables/use-item/index.test.ts
// Backoffice: real Pinia stores instead of @pinia/testing (store actions spied with vi.spyOn); the sdk module keeps its
// requestEndpoint, which sends the body as JSON text, so `command()` parses it back for the assertions.
import type { AppCollection, Field, Relation } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, ref } from 'vue';
import { sdk } from '../../api/sdk.ts';
import { applyConditions } from '../../components/form/utils/apply-conditions.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useCollection } from '../use-collection.ts';
import { usePermissions } from '../use-permissions/index.ts';
import { useItem } from './index.ts';

/** The request options of a recorded sdk.request call, with the JSON body parsed. */
function command(call: unknown[] | undefined): Record<string, any> {
	const options = (call?.[0] as () => Record<string, any>)();
	return typeof options['body'] === 'string' ? { ...options, body: JSON.parse(options['body']) } : options;
}

/**
 * Helper function to create field meta with default values
 * @param fieldMeta - Partial field meta properties to override defaults
 * @returns A complete field meta object with all required properties
 */
function createMockFieldMeta(fieldMeta: Partial<Field['meta']> = {}) {
	return {
		id: 1,
		collection: 'test',
		field: 'test_field',
		special: null,
		interface: null,
		options: null,
		display: null,
		display_options: null,
		readonly: false,
		hidden: false,
		sort: null,
		width: 'full',
		group: null,
		translations: null,
		required: false,
		note: null,
		conditions: null,
		validation: null,
		validation_message: null,
		...fieldMeta,
	} as Field['meta'];
}

vi.mock('../use-notices.ts', () => ({
	notify: vi.fn(),
	showUnexpectedError: vi.fn(),
}));

vi.mock('../../api/sdk.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../api/sdk.ts')>();

	const request = vi.fn(async (command: () => { path: string }) => {
		const { path } = command();
		let payload: Record<string, unknown> = { id: 1 };

		if (path === '/graphql') {
			payload = {
				item: payload,
			};
		}

		return payload;
	});

	return { ...actual, sdk: { request } };
});

vi.mock('../use-collection.ts', () => ({ useCollection: vi.fn() }));

vi.mock('../../utils/get-related-collection.ts', () => ({
	getRelatedCollection: vi.fn(() => ({
		relatedCollection: 'test_related',
		junctionCollection: null,
	})),
}));

vi.mock('../../components/form/utils/apply-conditions.ts', () => ({
	applyConditions: vi.fn(),
}));

vi.mock('../use-permissions/index.ts', () => ({
	usePermissions: vi.fn(() => ({
		itemPermissions: {
			fields: computed(() => []),
			loading: computed(() => false),
			refresh: vi.fn(),
		},
	})),
}));

vi.mock('../../components/form/utils/validate-item.ts', () => ({
	validateItem: vi.fn(() => []),
}));

vi.mock('../use-nested-validation.ts', () => ({
	useNestedValidation: vi.fn(() => ({
		nestedValidationErrors: computed(() => []),
	})),
}));

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('Save As Copy', () => {
	const mockCollection = {
		collection: 'test',
	} as AppCollection;

	test('should use graphql to fetch existing item', async () => {
		const mockPrimaryKeyFieldName = 'id';

		const sdkSpy = vi.spyOn(sdk, 'request');

		const mockPrimaryKeyField = {
			field: mockPrimaryKeyFieldName,
		} as Field;

		const mockFields = [mockPrimaryKeyField] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(command(sdkSpy.mock.calls[1])).toEqual({
			path: '/graphql',
			body: { query: 'query { item: test_by_id (id: 1) }' },
			method: 'POST',
		});
	});

	test('should keep manual primary key', async () => {
		const mockPrimaryKeyFieldName = 'id';

		const sdkSpy = vi.spyOn(sdk, 'request');

		const mockPrimaryKeyField = {
			collection: 'test',
			field: mockPrimaryKeyFieldName,
		} as Field;

		const mockFields = [mockPrimaryKeyField] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(command(sdkSpy.mock.lastCall)).toEqual(expect.objectContaining({ body: { [mockPrimaryKeyFieldName]: 1 } }));
	});

	test('should omit auto incremented primary key', async () => {
		const mockPrimaryKeyFieldName = 'id';

		const sdkSpy = vi.spyOn(sdk, 'request');

		const mockPrimaryKeyField = {
			field: mockPrimaryKeyFieldName,
			schema: {
				has_auto_increment: true,
			},
		} as Field;

		const mockFields = [mockPrimaryKeyField] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(command(sdkSpy.mock.lastCall)).toEqual(expect.objectContaining({ body: {} }));
	});

	test('should omit special uuid primary key', async () => {
		const mockPrimaryKeyFieldName = 'id';
		const sdkSpy = vi.spyOn(sdk, 'request');

		const mockPrimaryKeyField = {
			field: mockPrimaryKeyFieldName,
			meta: {
				special: ['uuid'],
			},
		} as Field;

		const mockFields = [mockPrimaryKeyField] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(command(sdkSpy.mock.lastCall)).toEqual(expect.objectContaining({ body: {} }));
	});
});

describe('Query merging', () => {
	const mockCollection = {
		collection: 'test',
	} as AppCollection;

	const mockPrimaryKeyField = {
		field: 'id',
	} as Field;

	const mockFields = [mockPrimaryKeyField] as Field[];

	beforeEach(() => {
		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);
	});

	test('should include extra query params when no content version is provided', async () => {
		const sdkSpy = vi.spyOn(sdk, 'request');

		useItem(ref('test'), ref(1), null, { fields: ['*', 'role.*'] });

		await Promise.resolve();

		const request = command(sdkSpy.mock.calls[0]);

		expect(request).toEqual(
			expect.objectContaining({
				path: '/items/test/1',
				params: expect.objectContaining({
					fields: ['*', 'role.*'],
				}),
			}),
		);

		expect(request?.['params']).not.toHaveProperty('version');
		expect(request?.['params']).not.toHaveProperty('versionRaw');
	});

	test('should merge extra query params with content version params', async () => {
		const sdkSpy = vi.spyOn(sdk, 'request');
		const currentVersion = ref({ id: 'version-id', key: 'v1' } as any);

		useItem(ref('test'), ref(1), currentVersion, { deep: { users: { _limit: 0 } } });

		await Promise.resolve();

		const request = command(sdkSpy.mock.calls[0]);

		expect(request).toEqual(
			expect.objectContaining({
				path: '/items/test/1',
				params: expect.objectContaining({
					deep: { users: { _limit: 0 } },
					version: 'v1',
					versionRaw: true,
				}),
			}),
		);
	});
});

describe('Clear Hidden Fields Condition', () => {
	const mockCollection = {
		collection: 'test',
	} as AppCollection;

	const mockPrimaryKeyField = {
		field: 'id',
	} as Field;

	test('should clear field when condition has clear_hidden_value_on_save set to true', async () => {
		const mockField = {
			field: 'status',
			meta: createMockFieldMeta({
				field: 'status',
				hidden: false,
				conditions: [
					{
						name: 'hidden_when_draft',
						rule: { status: { _eq: 'draft' } },
						hidden: true,
						clear_hidden_value_on_save: true,
					},
				],
			}),
			schema: {
				default_value: 'published',
			},
		} as Field;

		const mockFields = [mockField] as Field[];

		const sdkSpy = vi.spyOn(sdk, 'request').mockResolvedValue({
			id: 1,
			name: 'Test Item',
		});

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		vi.mocked(usePermissions).mockReturnValue({
			itemPermissions: {
				fields: computed(() => mockFields),
				loading: computed(() => false),
				refresh: vi.fn(),
			},
		} as any);

		vi.mocked(applyConditions).mockReturnValue({
			...mockField,
			meta: {
				...mockField.meta,
				id: 1,
				hidden: true,
				clear_hidden_value_on_save: true,
			},
		} as any);

		const { save, edits } = useItem(ref('test'), ref(1));

		edits.value = { status: 'draft' };

		await save();

		expect(command(sdkSpy.mock.lastCall)).toEqual({
			path: '/items/test/1',
			method: 'PATCH',
			body: { status: 'published' },
		});
	});

	test('should not clear field when condition does not have clear_hidden_value_on_save set', async () => {
		const mockField = {
			field: 'status',
			meta: createMockFieldMeta({
				field: 'status',
				hidden: false,
				conditions: [
					{
						name: 'hidden_when_draft',
						rule: { status: { _eq: 'draft' } },
						hidden: true,
						clear_hidden_value_on_save: false,
					},
				],
			}),
			schema: {
				default_value: 'published',
			},
		} as Field;

		const mockFields = [mockField] as Field[];

		const sdkSpy = vi.spyOn(sdk, 'request').mockResolvedValue({
			id: 1,
			name: 'Test Item',
		});

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		vi.mocked(applyConditions).mockReturnValue({
			...mockField,
			meta: {
				...mockField.meta,
				hidden: true,
				clear_hidden_value_on_save: false,
			},
		} as any);

		const { save, edits } = useItem(ref('test'), ref(1));

		edits.value = { status: 'draft' };

		await save();

		expect(command(sdkSpy.mock.lastCall)).toEqual({
			path: '/items/test/1',
			method: 'PATCH',
			body: { status: 'draft' },
		});
	});

	test('should not clear field when field is statically hidden (no conditions)', async () => {
		const mockField = {
			field: 'status',
			meta: createMockFieldMeta({
				field: 'status',
				hidden: true,
			}),
			schema: {
				default_value: 'published',
			},
		} as Field;

		const mockFields = [mockField] as Field[];

		const sdkSpy = vi.spyOn(sdk, 'request').mockResolvedValue({
			id: 1,
			name: 'Test Item',
		});

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { save, edits } = useItem(ref('test'), ref(1));

		edits.value = { status: 'draft' };

		await save();

		expect(command(sdkSpy.mock.lastCall)).toEqual({
			path: '/items/test/1',
			method: 'PATCH',
			body: { status: 'draft' },
		});
	});

	test('should clear field to null when no default value is set', async () => {
		const mockField = {
			field: 'status',
			meta: createMockFieldMeta({
				hidden: false,
				conditions: [
					{
						name: 'hidden_when_draft',
						rule: { status: { _eq: 'draft' } },
						hidden: true,
						clear_hidden_value_on_save: true,
					},
				],
			}),
			schema: {},
		} as Field;

		const mockFields = [mockField] as Field[];

		const sdkSpy = vi.spyOn(sdk, 'request').mockResolvedValue({
			id: 1,
			name: 'Test Item',
		});

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		vi.mocked(usePermissions).mockReturnValue({
			itemPermissions: {
				fields: computed(() => mockFields),
				loading: computed(() => false),
				refresh: vi.fn(),
			},
		} as any);

		vi.mocked(applyConditions).mockReturnValue({
			...mockField,
			meta: {
				...mockField.meta,
				hidden: true,
				clear_hidden_value_on_save: true,
			},
		} as any);

		const { save, edits } = useItem(ref('test'), ref(1));

		edits.value = { status: 'draft' };

		await save();

		expect(command(sdkSpy.mock.lastCall)).toEqual({
			path: '/items/test/1',
			method: 'PATCH',
			body: { status: null },
		});
	});

	test('should clear multiple fields when multiple conditions are triggered', async () => {
		const mockField1 = {
			field: 'status',
			meta: createMockFieldMeta({
				hidden: false,
				conditions: [
					{
						name: 'hidden_when_draft',
						rule: { status: { _eq: 'draft' } },
						hidden: true,
						clear_hidden_value_on_save: true,
					},
				],
			}),
			schema: {
				default_value: 'published',
			},
		} as Field;

		const mockField2 = {
			field: 'description',
			meta: createMockFieldMeta({
				hidden: false,
				conditions: [
					{
						name: 'hidden_when_draft',
						rule: { status: { _eq: 'draft' } },
						hidden: true,
						clear_hidden_value_on_save: true,
					},
				],
			}),
			schema: {
				default_value: 'Default description',
			},
		} as Field;

		const mockFields = [mockField1, mockField2] as Field[];

		const sdkSpy = vi.spyOn(sdk, 'request').mockResolvedValue({
			id: 1,
			name: 'Test Item',
		});

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		vi.mocked(usePermissions).mockReturnValue({
			itemPermissions: {
				fields: computed(() => mockFields),
				loading: computed(() => false),
				refresh: vi.fn(),
			},
		} as any);

		vi.mocked(applyConditions)
			.mockReturnValueOnce({
				...mockField1,
				meta: createMockFieldMeta({
					...mockField1.meta,
					hidden: true,
					clear_hidden_value_on_save: true,
				}),
			})
			.mockReturnValueOnce({
				...mockField2,
				meta: createMockFieldMeta({
					...mockField2.meta,
					hidden: true,
					clear_hidden_value_on_save: true,
				}),
			});

		const { save, edits } = useItem(ref('test'), ref(1));

		edits.value = { status: 'draft', description: 'Custom description' };

		await save();

		expect(command(sdkSpy.mock.lastCall)).toEqual({
			path: '/items/test/1',
			method: 'PATCH',
			body: { status: 'published', description: 'Default description' },
		});
	});

	test('should return original edits when no conditions are triggered', async () => {
		const mockField = {
			field: 'status',
			meta: createMockFieldMeta({
				hidden: false,
				conditions: [
					{
						name: 'hidden_when_published',
						rule: { status: { _eq: 'published' } },
						hidden: true,
						clear_hidden_value_on_save: true,
					},
				],
			}),
			schema: {
				default_value: 'published',
			},
		} as Field;

		const mockFields = [mockField] as Field[];

		const sdkSpy = vi.spyOn(sdk, 'request').mockResolvedValue({
			id: 1,
			name: 'Test Item',
		});

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		vi.mocked(usePermissions).mockReturnValue({
			itemPermissions: {
				fields: computed(() => mockFields),
				loading: computed(() => false),
				refresh: vi.fn(),
			},
		} as any);

		vi.mocked(applyConditions).mockReturnValue({
			...mockField,
			meta: createMockFieldMeta({
				...mockField.meta,
				hidden: false,
				clear_hidden_value_on_save: false,
			}),
		});

		const { save, edits } = useItem(ref('test'), ref(1));

		edits.value = { status: 'draft' };

		await save();

		expect(command(sdkSpy.mock.lastCall)).toEqual({
			path: '/items/test/1',
			method: 'PATCH',
			body: { status: 'draft' },
		});
	});
});

describe('findExistingRelatedItems SEARCH fallback', () => {
	const mockCollection = {
		collection: 'test',
		meta: {
			item_duplication_fields: ['related.field_1'],
		},
	} as unknown as AppCollection;

	const mockPrimaryKeyField = {
		field: 'id',
		schema: { has_auto_increment: true },
	} as Field;

	function setupRelationMocks() {
		const fieldsStore = useFieldsStore();
		const relationsStore = useRelationsStore();

		const relatedPkField = { field: 'id', schema: { has_auto_increment: true } } as Field;

		vi.spyOn(fieldsStore, 'getPrimaryKeyFieldForCollection').mockReturnValue(relatedPkField);

		vi.spyOn(relationsStore, 'getRelationsForCollection').mockReturnValue([
			{
				collection: 'test_related',
				field: 'test_id',
				related_collection: 'test',
				meta: {
					one_field: 'related',
					junction_field: null,
				},
			} as unknown as Relation,
		]);

		vi.mocked(relationsStore).relations = [];

		return { fieldsStore, relationsStore };
	}

	test('should use GET when URL is short', async () => {
		const sdkSpy = vi.spyOn(sdk, 'request');

		const mockFields = [mockPrimaryKeyField] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		setupRelationMocks();

		sdkSpy
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({ item: { id: 1, related: [{ id: 10 }] } })
			.mockResolvedValueOnce([{ id: 10, field_1: 'value' }])
			.mockResolvedValueOnce({});

		const { saveAsCopy } = useItem(ref('test'), ref(1));
		await saveAsCopy();

		const findCall = command(sdkSpy.mock.calls[2]);

		expect(findCall).toEqual(
			expect.objectContaining({
				path: '/items/test_related',
				params: expect.objectContaining({
					fields: expect.any(Array),
					filter: { test_id: { _eq: 1 } },
				}),
			}),
		);

		expect(findCall!['method']).toBeUndefined();
	});

	test('should use SEARCH when URL exceeds 8KB', async () => {
		const longFields = Array.from(
			{ length: 200 },
			(_, i) => `related.very_long_field_name_for_testing_uri_limit_threshold_${i}`,
		);

		const collectionWithLongFields = {
			collection: 'test',
			meta: {
				item_duplication_fields: longFields,
			},
		} as unknown as AppCollection;

		const sdkSpy = vi.spyOn(sdk, 'request');

		const mockFields = [mockPrimaryKeyField] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => collectionWithLongFields),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		setupRelationMocks();

		sdkSpy
			.mockResolvedValueOnce({}) // getItem
			.mockResolvedValueOnce({ item: { id: 1, related: [{ id: 10 }] } }) // graphql fetch
			.mockResolvedValueOnce([{ id: 10, field_1: 'value' }]) // findExistingRelatedItems
			.mockResolvedValueOnce({}); // save

		const { saveAsCopy } = useItem(ref('test'), ref(1));
		await saveAsCopy();

		const findCall = command(sdkSpy.mock.calls[2]);

		expect(findCall).toEqual(
			expect.objectContaining({
				path: '/items/test_related',
				method: 'SEARCH',
				body: {
					query: {
						fields: expect.any(Array),
						filter: { test_id: { _eq: 1 } },
					},
				},
			}),
		);
	});
});
