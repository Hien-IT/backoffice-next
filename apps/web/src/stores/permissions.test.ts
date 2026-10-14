import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { calls, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { usePermissionsStore } from './permissions.ts';
import { useUserStore } from './user.ts';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

const permissions = {
	directus_files: { read: { access: 'full' } },
	articles: {
		create: { access: 'partial', presets: { owner: '$CURRENT_USER.id', team: { id: '$CURRENT_ROLE.name' } } },
	},
};

test('hydrate reads /permissions/me and loads the user fields its presets use', async () => {
	const fetch = mockApi({ 'GET /permissions/me': permissions, 'GET /users/me': { name: 'r' } });
	const user = useUserStore();
	user.currentUser = { id: 'u1' } as AppUser;
	const store = usePermissionsStore();

	await store.hydrate();

	expect(calls(fetch)).toEqual(['GET /permissions/me', 'GET /users/me?fields=id,role.name']);
	expect(store.permissions).toEqual(permissions);
});

test('hydrate without dynamic variables reads only /permissions/me', async () => {
	const fetch = mockApi({ 'GET /permissions/me': { a: { read: { access: 'none' } } } });

	await usePermissionsStore().hydrate();

	expect(calls(fetch)).toEqual(['GET /permissions/me']);
});

test('getPermission, hasPermission and dehydrate', () => {
	const store = usePermissionsStore();
	const user = useUserStore();
	store.permissions = permissions as never;
	user.currentUser = { id: 'u1', admin_access: false } as AppUser;

	expect(store.getPermission('directus_files', 'read')).toEqual({ access: 'full' });
	expect(store.getPermission('directus_users', 'read')).toBeNull();
	expect(store.hasPermission('directus_files', 'read')).toBe(true);
	expect(store.hasPermission('directus_users', 'read')).toBe(false);

	user.currentUser = { id: 'u1', admin_access: true } as AppUser;
	expect(store.hasPermission('directus_users', 'read')).toBe(true);

	store.dehydrate();
	expect(store.permissions).toEqual({});
});
