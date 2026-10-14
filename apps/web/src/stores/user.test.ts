import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import { i18n } from '../lang/index.ts';
import { calls, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { useServerStore } from './server.ts';
import { useUserStore } from './user.ts';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
	vi.unstubAllGlobals();
	i18n.global.locale.value = 'en-US';
});

const route = (fullPath: string) => ({ path: fullPath.split('?')[0], fullPath }) as RouteLocationNormalized;

describe('hydrate', () => {
	test('merges /users/me, /policies/me/globals and /roles/me like Directus', async () => {
		const fetch = mockApi({
			'GET /users/me': { id: 'u1', avatar: 'f1', language: null },
			'GET /policies/me/globals': { app_access: true, admin_access: false, enforce_tfa: false },
			'GET /roles/me': [{ id: 'r1' }],
		});
		const store = useUserStore();

		await store.hydrate();

		expect(calls(fetch).sort()).toEqual([
			'GET /policies/me/globals',
			'GET /roles/me?fields=id',
			'GET /users/me?fields=*,role.id',
		]);
		expect(store.currentUser).toEqual({
			id: 'u1',
			avatar: { id: 'f1' },
			language: null,
			app_access: true,
			admin_access: false,
			enforce_tfa: false,
			roles: [{ id: 'r1' }],
		});
		expect(store.isAdmin).toBe(false);
	});

	test('keeps the error and no user when a request fails', async () => {
		mockApi({});
		const store = useUserStore();

		await store.hydrate();

		expect(store.currentUser).toBeNull();
		expect(store.error).toBeTruthy();
		expect(store.loading).toBe(false);
	});

	test('hydrateAdditionalFields merges extra fields and ignores errors', async () => {
		mockApi({ 'GET /users/me': { department: 'x' } });
		const store = useUserStore();
		store.currentUser = { id: 'u1' } as AppUser;

		await store.hydrateAdditionalFields(['department']);
		expect(store.currentUser).toEqual({ id: 'u1', department: 'x' });

		mockApi({});
		await store.hydrateAdditionalFields(['other']);
		expect(store.currentUser).toEqual({ id: 'u1', department: 'x' });

		await store.dehydrate();
		expect(store.currentUser).toBeNull();
	});
});

describe('language and direction', () => {
	test('user language → default_language of settings → en-US', () => {
		const store = useUserStore();
		const server = useServerStore();

		expect(store.language).toBe('en-US');

		server.info.project = { default_language: 'vi-VN' } as never;
		expect(store.language).toBe('vi-VN');

		store.currentUser = { id: 'u1', language: 'de-DE' } as AppUser;
		expect(store.language).toBe('de-DE');
	});

	test('direction follows the loaded language unless the user saved one', () => {
		const store = useUserStore();
		store.currentUser = { id: 'u1', language: 'ar-SA' } as AppUser;

		// ar-SA is not bundled: the app shows en-US, so left to right (D-46)
		expect(store.textDirection).toBe('ltr');

		i18n.global.locale.value = 'ar-SA' as never;
		expect(store.textDirection).toBe('rtl');

		store.currentUser = { id: 'u1', text_direction: 'ltr' } as AppUser;
		expect(store.textDirection).toBe('ltr');
	});

	test('fullName', () => {
		const store = useUserStore();
		expect(store.fullName).toBeNull();

		store.currentUser = { id: 'u1', first_name: 'Ada', last_name: 'Lovelace' } as AppUser;
		expect(store.fullName).toBe('Ada Lovelace');

		store.currentUser = { share: 's1', app_access: false, admin_access: false };
		expect(store.fullName).toBeNull();
	});
});

describe('trackPage', () => {
	test('writes last_page through PATCH /users/me/track/page', async () => {
		const fetch = mockApi({ 'PATCH /users/me/track/page': null });
		const store = useUserStore();
		store.currentUser = { id: 'u1', last_page: null } as AppUser;

		await store.trackPage(route('/files?x=1'));

		expect(calls(fetch)).toEqual(['PATCH /users/me/track/page']);
		expect(fetch.mock.calls[0]![1]!.body).toBe('{"last_page":"/files?x=1"}');
		expect((store.currentUser as AppUser).last_page).toBe('/files?x=1');
	});

	test('skips previews, share users and no user', async () => {
		const fetch = mockApi({});
		const store = useUserStore();

		await store.trackPage(route('/files'));
		store.currentUser = { id: 'u1' } as AppUser;
		await store.trackPage(route('/content/a/1/preview'));
		store.currentUser = { share: 's1', app_access: false, admin_access: false };
		await store.trackPage(route('/content'));

		expect(fetch).not.toHaveBeenCalled();
	});
});
