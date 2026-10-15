// Behaviour of directus/app/src/composables/use-permissions/**/*.test.ts (collection, item, lib, utils) on the
// Backoffice stores: the Directus tests mock the stores with @pinia/testing, these use real Pinia stores and mock only
// useCollection, as the Directus tests mock @directus/composables.
import type { Field } from '@directus/types';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { calls, json, mockApi } from '../../test-utils/fetch.ts';
import { usePermissionsStore, type CollectionAccess } from '../../stores/permissions.ts';
import { useUserStore } from '../../stores/user.ts';
import type { AppUser } from '../../types/user.ts';
import { usePermissions } from './index.ts';
import { useCollectionPermissions } from './collection/use-collection-permissions.ts';
import { isFieldAllowed } from './utils/is-field-allowed.ts';

const collectionMeta = ref<Record<string, unknown>>({});
const rawFields = ref<Field[]>([]);

vi.mock('../use-collection.ts', () => ({
	useCollection: () => ({ info: ref({ meta: collectionMeta.value }), fields: rawFields }),
}));

const field = (name: string, meta: Record<string, unknown> = {}) =>
	({ collection: 'articles', field: name, type: 'string', schema: { default_value: null }, meta }) as unknown as Field;

function setUser(admin = false) {
	useUserStore().currentUser = { id: 'u1', admin_access: admin, role: { id: 'r1' } } as unknown as AppUser;
}

function setPermissions(permissions: CollectionAccess) {
	usePermissionsStore().permissions = permissions;
}

beforeEach(() => {
	setActivePinia(createPinia());
	collectionMeta.value = { sort_field: 'sort', archive_field: 'status' };
	rawFields.value = [field('id'), field('title'), field('status'), field('sort')];
	setUser();
});

afterEach(() => vi.unstubAllGlobals());

describe('isFieldAllowed', () => {
	test('needs the field or a wildcard', () => {
		expect(isFieldAllowed({ access: 'full', fields: ['*'] }, 'a')).toBe(true);
		expect(isFieldAllowed({ access: 'full', fields: ['a'] }, 'a')).toBe(true);
		expect(isFieldAllowed({ access: 'full', fields: ['b'] }, 'a')).toBe(false);
		expect(isFieldAllowed({ access: 'full' }, 'a')).toBe(false);
	});
});

describe('useCollectionPermissions', () => {
	test('actions follow the permissions store', () => {
		setPermissions({
			articles: { read: { access: 'full' }, create: { access: 'none' }, delete: { access: 'partial' } },
		});

		const p = useCollectionPermissions('articles');

		expect(p.readAllowed.value).toBe(true);
		expect(p.createAllowed.value).toBe(false);
		expect(p.updateAllowed.value).toBe(false);
		expect(p.deleteAllowed.value).toBe(true);
	});

	test('sort needs a sort field and update on it; admins always may', () => {
		setPermissions({ articles: { update: { access: 'full', fields: ['title'] } } });
		expect(useCollectionPermissions('articles').sortAllowed.value).toBe(false);

		setPermissions({ articles: { update: { access: 'full', fields: ['sort'] } } });
		expect(useCollectionPermissions('articles').sortAllowed.value).toBe(true);

		collectionMeta.value = {};
		expect(useCollectionPermissions('articles').sortAllowed.value).toBe(false);

		collectionMeta.value = { sort_field: 'sort' };
		setUser(true);
		setPermissions({});
		expect(useCollectionPermissions('articles').sortAllowed.value).toBe(true);
	});

	test('archive needs the archive field, update on it and update allowed', () => {
		setPermissions({ articles: { update: { access: 'full', fields: ['status'] } } });
		expect(useCollectionPermissions('articles').archiveAllowed.value).toBe(true);

		setPermissions({ articles: { update: { access: 'full', fields: ['title'] } } });
		expect(useCollectionPermissions('articles').archiveAllowed.value).toBe(false);

		collectionMeta.value = {};
		setPermissions({ articles: { update: { access: 'full', fields: ['*'] } } });
		expect(useCollectionPermissions('articles').archiveAllowed.value).toBe(false);
	});

	test('revisions need read on directus_revisions', () => {
		setPermissions({ directus_revisions: { read: { access: 'partial' } } });
		expect(useCollectionPermissions('articles').revisionsAllowed.value).toBe(true);

		setPermissions({});
		expect(useCollectionPermissions('articles').revisionsAllowed.value).toBe(false);
	});
});

describe('usePermissions (item)', () => {
	test('full and none access answer locally; partial asks the item permissions endpoint', async () => {
		const fetch = mockApi({
			'GET /permissions/me/articles/7': {
				update: { access: true },
				delete: { access: false },
				share: { access: true },
			},
		});

		setPermissions({
			articles: { update: { access: 'partial', fields: ['*'] }, delete: { access: 'none' }, share: { access: 'full' } },
		});

		const { itemPermissions } = usePermissions('articles', 7, false);
		expect(itemPermissions.deleteAllowed.value).toBe(false);
		expect(itemPermissions.shareAllowed.value).toBe(true);

		// The item permissions are fetched lazily, on the first read (computedAsync `lazy`), like Directus.
		expect(itemPermissions.updateAllowed.value).toBe(false);
		await flushPromises();

		expect(calls(fetch)).toEqual(['GET /permissions/me/articles/7']);
		expect(itemPermissions.updateAllowed.value).toBe(true);
		expect(itemPermissions.saveAllowed.value).toBe(true);
	});

	test('new items: save follows create, update/delete/share are false', () => {
		mockApi({
			'GET /permissions/me/articles': {
				update: { access: false },
				delete: { access: false },
				share: { access: false },
			},
		});
		setPermissions({
			articles: { create: { access: 'full', fields: ['*'] }, update: { access: 'full', fields: ['*'] } },
		});

		const { collectionPermissions, itemPermissions } = usePermissions('articles', null, true);

		expect(itemPermissions.updateAllowed.value).toBe(false);
		expect(itemPermissions.saveAllowed.value).toBe(collectionPermissions.createAllowed.value);
		expect(itemPermissions.saveAllowed.value).toBe(true);
	});

	test('version editing allows update without the collection right', () => {
		mockApi({});
		setPermissions({ articles: { update: { access: 'none' } } });

		expect(usePermissions('articles', 1, false, true).itemPermissions.updateAllowed.value).toBe(true);
	});

	test('an error of the item permissions endpoint is optimistic', async () => {
		mockApi({
			'GET /permissions/me/articles/1': () =>
				json({ errors: [{ message: 'x', extensions: { code: 'INTERNAL' } }] }, 500),
		});
		setPermissions({ articles: { update: { access: 'partial', fields: ['*'] } } });

		const { itemPermissions } = usePermissions('articles', 1, false);
		void itemPermissions.updateAllowed.value;
		await flushPromises();

		expect(itemPermissions.updateAllowed.value).toBe(true);
	});

	test('fields: unreadable fields are removed, fields without update are read-only, presets become defaults', async () => {
		mockApi({
			'GET /permissions/me/articles/1': { update: { access: true }, delete: { access: true }, share: { access: true } },
		});
		setPermissions({
			articles: {
				read: { access: 'full', fields: ['id', 'title', 'status'] },
				update: { access: 'full', fields: ['title'], presets: { status: 'draft' } },
			},
		});

		const { itemPermissions } = usePermissions('articles', 1, false);
		await flushPromises();

		const fields = itemPermissions.fields.value;
		expect(fields.map((f) => f.field)).toEqual(['id', 'title', 'status']);
		expect(fields.find((f) => f.field === 'title')?.meta).toEqual({});
		expect(fields.find((f) => f.field === 'id')?.meta).toMatchObject({ readonly: true, non_editable: true });
		expect(fields.find((f) => f.field === 'status')?.schema?.default_value).toBe('draft');
	});

	test('fields of an admin are all editable', () => {
		mockApi({});
		setUser(true);

		const fields = usePermissions('articles', 1, false).itemPermissions.fields.value;
		expect(fields).toHaveLength(4);
		expect(fields.every((f) => !f.meta?.readonly)).toBe(true);
	});
});
