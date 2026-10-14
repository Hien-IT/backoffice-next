import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { useCollectionsStore } from './collections.ts';
import { useFieldsStore } from './fields.ts';
import { usePresetsStore } from './presets.ts';
import { useRelationsStore } from './relations.ts';
import { useSettingsStore } from './settings.ts';
import { useUserStore } from './user.ts';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

const appUser = { id: 'u1', role: { id: 'r1' } } as AppUser;
const shareUser = { share: 's1', app_access: false, admin_access: false };

describe('settings', () => {
	test('hydrate reads /settings for app users only', async () => {
		const fetch = mockApi({ 'GET /settings': { project_name: 'Acme', module_bar: null } });
		const user = useUserStore();
		const store = useSettingsStore();

		await store.hydrate();
		user.currentUser = shareUser;
		await store.hydrate();
		expect(fetch).not.toHaveBeenCalled();

		user.currentUser = appUser;
		await store.hydrate();
		expect(store.settings).toEqual({ project_name: 'Acme', module_bar: null });

		await store.dehydrate();
		expect(store.settings).toBeNull();
	});

	test('updateSettings patches and rolls back on error', async () => {
		const fetch = mockApi({ 'PATCH /settings': { project_name: 'New', module_bar: null } });
		const store = useSettingsStore();
		store.settings = { project_name: 'Old' } as never;

		await store.updateSettings({ project_name: 'New' });
		expect(calls(fetch)).toEqual(['PATCH /settings']);
		expect(store.settings).toEqual({ project_name: 'New', module_bar: null });

		mockApi({ 'PATCH /settings': () => json({ errors: [{ message: 'no' }] }, 403) });
		await expect(store.updateSettings({ project_name: 'Other' })).rejects.toBeTruthy();
		expect(store.settings).toEqual({ project_name: 'New', module_bar: null });
	});
});

describe('data stores hydrate (D-45)', () => {
	test('collections, fields and relations keep the GET answer', async () => {
		const fetch = mockApi({
			'GET /collections': [{ collection: 'a' }],
			'GET /fields': [{ field: 'id' }],
			'GET /relations': [],
		});
		const collections = useCollectionsStore();
		const fields = useFieldsStore();
		const relations = useRelationsStore();

		await Promise.all([collections.hydrate(), fields.hydrate(), relations.hydrate()]);

		expect(calls(fetch).sort()).toEqual(['GET /collections', 'GET /fields', 'GET /relations']);
		expect(collections.collections).toMatchObject([{ collection: 'a', name: 'A' }]);
		expect(fields.fields).toMatchObject([{ field: 'id', name: 'ID' }, { field: '$thumbnail' }]);
		expect(relations.relations).toEqual([]);

		await Promise.all([collections.dehydrate(), fields.dehydrate(), relations.dehydrate()]);
		expect(collections.collections).toEqual([]);
		expect(fields.fields).toEqual([]);
	});

	test('presets reads user, role and global presets like Directus', async () => {
		const fetch = mockApi({ 'GET /presets': [{ id: 1 }] });
		const user = useUserStore();
		const store = usePresetsStore();

		user.currentUser = shareUser;
		await store.hydrate();
		expect(fetch).not.toHaveBeenCalled();

		user.currentUser = appUser;
		await store.hydrate();

		expect(calls(fetch).sort()).toEqual([
			'GET /presets?limit=-1&filter[role][_eq]=r1&filter[user][_null]=true',
			'GET /presets?limit=-1&filter[role][_null]=true&filter[user][_null]=true',
			'GET /presets?limit=-1&filter[user][_eq]=u1',
		]);
		expect(store.collectionPresets).toHaveLength(3);

		await store.dehydrate();
		expect(store.collectionPresets).toEqual([]);
	});

	test('presets without a role skips the role query', async () => {
		const fetch = mockApi({ 'GET /presets': [] });
		useUserStore().currentUser = { id: 'u1', role: null } as AppUser;

		await usePresetsStore().hydrate();

		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
