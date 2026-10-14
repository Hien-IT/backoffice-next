import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { calls, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { useNotificationsStore } from './notifications.ts';
import { useUserStore } from './user.ts';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

test('hydrate counts unread inbox notifications of the user with the Directus query', async () => {
	const fetch = mockApi({ 'GET /notifications': [{ count: { id: '3' } }] });
	useUserStore().currentUser = { id: 'u1' } as AppUser;
	const store = useNotificationsStore();

	await store.hydrate();

	expect(calls(fetch)).toEqual([
		'GET /notifications?filter={"_and":[{"recipient":{"_eq":"u1"}},{"status":{"_eq":"inbox"}}]}&aggregate={"count":"id"}',
	]);
	expect(store.unread).toBe(3);
});

test('no request for share users or without user; setUnreadCount clamps at 0', async () => {
	const fetch = mockApi({});
	const store = useNotificationsStore();

	await store.hydrate();
	useUserStore().currentUser = { share: 's1', app_access: false, admin_access: false };
	await store.hydrate();
	await store.refreshUnreadCount();
	expect(fetch).not.toHaveBeenCalled();

	store.setUnreadCount(-2);
	expect(store.unread).toBe(0);
	store.setUnreadCount(4);
	await store.dehydrate();
	expect(store.unread).toBe(0);
});
