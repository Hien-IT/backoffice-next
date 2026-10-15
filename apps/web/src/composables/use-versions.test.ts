// Ported from directus/app/src/composables/use-versions.test.ts
// Backoffice: the SDK client is mocked in place of `@/api` (a request is `{ path, method, params, body }`) and
// vue-router in place of @vueuse/router; the `?version=` sync tests are Backoffice ones.
import type { ContentVersion } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick, ref } from 'vue';
import { useVersions } from './use-versions.ts';

const { request, route, push } = vi.hoisted(() => ({
	request: vi.fn(),
	route: { query: {} as Record<string, string> },
	push: vi.fn(),
}));

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint:
		(path: string, options: object = {}) =>
		() => ({ path, ...options }),
}));

vi.mock('vue-router', async () => {
	const { reactive } = await import('vue');
	const reactiveRoute = reactive(route);
	return { useRoute: () => reactiveRoute, useRouter: () => ({ push }) };
});

vi.mock('./use-permissions/index.ts', () => ({
	useCollectionPermissions: vi.fn(() => ({
		createAllowed: ref(true),
		readAllowed: ref(true),
	})),
	usePermissions: vi.fn(() => ({
		itemPermissions: {
			fields: computed(() => []),
		},
	})),
}));

vi.mock('./use-nested-validation.ts', () => ({
	useNestedValidation: vi.fn(() => ({
		nestedValidationErrors: ref([]),
	})),
}));

vi.mock('./use-notices.ts', () => ({ showUnexpectedError: vi.fn() }));

vi.mock('../components/form/utils/get-default-values-from-fields.ts', () => ({
	getDefaultValuesFromFields: vi.fn(() => ref({})),
}));

vi.mock('../components/form/utils/validate-item.ts', () => ({
	validateItem: vi.fn(() => []),
}));

vi.mock('../components/form/utils/merge-item-data.ts', () => ({
	mergeItemData: vi.fn((_defaults: any, _item: any, edits: any) => edits),
}));

vi.mock('../components/form/utils/push-group-options-down.ts', () => ({
	pushGroupOptionsDown: vi.fn(() => []),
}));

/** Answers GET /versions with `versions` (once), the rest with `[]`. */
function answerVersions(versions: ContentVersion[]) {
	request.mockImplementationOnce(async () => versions);
}

function version(overrides: Partial<ContentVersion>): ContentVersion {
	return {
		id: 'version-id',
		key: 'my-local-version',
		name: 'Local Version',
		collection: 'test_collection',
		item: '1',
		hash: 'abc123',
		date_created: '2024-01-01',
		date_updated: '2024-01-02',
		user_created: 'user-1',
		user_updated: 'user-1',
		delta: {},
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());

	route.query = {};
	request.mockResolvedValue([]);
});

afterEach(() => {
	vi.clearAllMocks();
	request.mockReset();
});

describe('useVersions', () => {
	describe('versions computed', () => {
		it('should always include global draft version first', async () => {
			const { versions, getVersions } = useVersions(ref('test_collection'), ref(true), ref('1'));

			await getVersions();

			expect(versions.value.length).toBeGreaterThanOrEqual(1);
			expect(versions.value[0]?.key).toBe('draft');
			expect(versions.value[0]?.type).toBe('global');
		});

		it('should create virtual draft version with id "+" when no draft version exists in the database', async () => {
			const { versions, getVersions } = useVersions(ref('test_collection'), ref(true), ref('1'));

			await getVersions();

			const draftVersion = versions.value.find((v) => v.key === 'draft');

			expect(draftVersion).toBeDefined();
			expect(draftVersion?.id).toBe('+');
			expect(draftVersion?.type).toBe('global');
		});

		it('should use existing draft version when one exists in the database', async () => {
			answerVersions([version({ id: 'existing-draft-id', key: 'draft', name: 'My Draft' })]);

			const { versions } = useVersions(ref('test_collection'), ref(true), ref('1'));

			// Wait for the immediate watch to complete
			await vi.waitFor(() => expect(versions.value[0]?.id).toBe('existing-draft-id'));

			const draftVersion = versions.value.find((v) => v.key === 'draft');

			expect(draftVersion).toBeDefined();
			expect(draftVersion?.id).toBe('existing-draft-id');
			expect(draftVersion?.type).toBe('global');
		});

		it('should mark non-draft versions as local type', async () => {
			answerVersions([version({ id: 'local-version-id' })]);

			const { versions } = useVersions(ref('test_collection'), ref(true), ref('1'));

			await vi.waitFor(() => expect(versions.value).toHaveLength(2));

			const foundLocalVersion = versions.value.find((v) => v.key === 'my-local-version');

			expect(foundLocalVersion).toBeDefined();
			expect(foundLocalVersion?.type).toBe('local');
		});

		it('should place draft version before local versions', async () => {
			answerVersions([version({ id: 'local-version-id' })]);

			const { versions } = useVersions(ref('test_collection'), ref(true), ref('1'));

			await vi.waitFor(() => expect(versions.value).toHaveLength(2));

			expect(versions.value[0]?.key).toBe('draft');
			expect(versions.value[0]?.type).toBe('global');
			expect(versions.value[1]?.key).toBe('my-local-version');
			expect(versions.value[1]?.type).toBe('local');
		});

		it('should set currentVersion to null after promoting a Draft version', async () => {
			answerVersions([version({ id: 'draft-id', key: 'draft', name: 'My Draft' })]);

			const { versions, currentVersion, deleteVersion } = useVersions(ref('test_collection'), ref(true), ref('1'));

			await vi.waitFor(() => expect(versions.value[0]?.id).toBe('draft-id'));

			// Select the draft version
			currentVersion.value = versions.value.find((v) => v.key === 'draft') ?? null;
			expect(currentVersion.value).not.toBeNull();
			expect(currentVersion.value?.type).toBe('global');

			deleteVersion(true);

			expect(currentVersion.value).toBeNull();
		});

		it('should keep currentVersion as Draft when discarding edits', async () => {
			answerVersions([version({ id: 'draft-id', key: 'draft', name: 'My Draft' })]);

			const { versions, currentVersion, deleteVersion } = useVersions(ref('test_collection'), ref(true), ref('1'));

			await vi.waitFor(() => expect(versions.value[0]?.id).toBe('draft-id'));

			// Select the draft version
			currentVersion.value = versions.value.find((v) => v.key === 'draft') ?? null;
			await nextTick();
			expect(currentVersion.value).not.toBeNull();
			expect(currentVersion.value?.type).toBe('global');

			deleteVersion(false);
			await nextTick();

			// currentVersion should remain non-null (Draft stays selected, re-created as virtual)
			expect(currentVersion.value).not.toBeNull();
			expect(currentVersion.value?.key).toBe('draft');
		});
	});

	describe('saveVersion', () => {
		it('should use actualPrimaryKey for new version creation on singletons', async () => {
			const { saveVersion, currentVersion, versions } = useVersions(ref('singleton_collection'), ref(true), ref(null));
			await vi.waitFor(() => expect(request).toHaveBeenCalled());

			currentVersion.value = versions.value.find((v) => v.key === 'draft')!;

			request.mockReset();
			request
				.mockResolvedValueOnce({ id: 'new-version-id' })
				.mockResolvedValueOnce({ title: 'saved' })
				.mockResolvedValueOnce([]);

			const actualPrimaryKey = 1;
			await saveVersion(ref({ title: 'Updated' }), ref({ id: 1, title: 'Original' }), actualPrimaryKey);

			expect(request.mock.calls[0]![0]).toEqual({
				path: '/versions',
				method: 'POST',
				body: { key: 'draft', collection: 'singleton_collection', item: '1' },
			});

			// Backoffice: the save goes to the created version.
			expect(request.mock.calls[1]![0]).toEqual({
				path: '/versions/new-version-id/save',
				method: 'POST',
				body: { title: 'Updated' },
			});
		});

		it('should return early when actualPrimaryKey is null', async () => {
			const { saveVersion, currentVersion, versions } = useVersions(ref('singleton_collection'), ref(true), ref(null));
			await vi.waitFor(() => expect(request).toHaveBeenCalled());

			currentVersion.value = versions.value.find((v) => v.key === 'draft')!;
			request.mockClear();

			const actualPrimaryKey = null;
			await saveVersion(ref({ title: 'Updated' }), ref({ id: 1, title: 'Original' }), actualPrimaryKey);

			expect(request).not.toHaveBeenCalled();
		});

		it('saves an existing version and merges the answer into the item (Backoffice)', async () => {
			answerVersions([version({ id: 'local-id' })]);

			const { saveVersion, currentVersion, versions } = useVersions(ref('test_collection'), ref(false), ref('1'));
			await vi.waitFor(() => expect(versions.value).toHaveLength(2));

			currentVersion.value = versions.value[1]!;
			request.mockReset();
			request.mockResolvedValueOnce({ title: 'saved' }).mockResolvedValueOnce([]);

			const edits = ref<Record<string, any>>({ title: 'Updated' });
			const item = ref<Record<string, any>>({ id: 1, title: 'Original' });

			await expect(saveVersion(edits, item, 1)).resolves.toEqual({ title: 'saved' });

			expect(request.mock.calls[0]![0]).toMatchObject({ path: '/versions/local-id/save', method: 'POST' });
			expect(item.value).toEqual({ id: 1, title: 'saved' });
			expect(edits.value).toEqual({});
		});
	});

	describe('?version= query (Backoffice)', () => {
		it('lists the versions of the item, newest first', async () => {
			useVersions(ref('test_collection'), ref(false), ref('1'));

			await vi.waitFor(() => expect(request).toHaveBeenCalled());

			expect(request.mock.calls[0]![0]).toEqual({
				path: '/versions',
				params: {
					filter: { _and: [{ collection: { _eq: 'test_collection' } }, { item: { _eq: '1' } }] },
					sort: '-date_created',
					fields: ['*'],
				},
			});
		});

		it('does not list versions of a new item', () => {
			useVersions(ref('test_collection'), ref(false), ref('+'));

			expect(request).not.toHaveBeenCalled();
		});

		it('selects the version of the query and pushes the key of the selected version', async () => {
			route.query = { version: 'my-local-version' };
			answerVersions([version({ id: 'local-id' })]);

			const { currentVersion, versions, addVersion } = useVersions(ref('test_collection'), ref(false), ref('1'));

			await vi.waitFor(() => expect(currentVersion.value?.id).toBe('local-id'));

			currentVersion.value = versions.value[0]!;
			await nextTick();

			expect(push).toHaveBeenLastCalledWith({ query: { version: 'draft' } });

			await addVersion(version({ id: 'new-id', key: 'new-key' }));
			await nextTick();

			expect(push).toHaveBeenLastCalledWith({ query: { version: 'new-key' } });
			expect(currentVersion.value?.id).toBe('new-id');

			currentVersion.value = null;
			await nextTick();

			expect(push).toHaveBeenLastCalledWith({ query: {} });
		});
	});
});
