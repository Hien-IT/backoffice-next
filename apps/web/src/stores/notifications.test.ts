import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useNotices } from '../composables/use-notices.ts';
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

test('the Directus members for app extensions use the in-place notices (spec 020 FR-079, D-66)', () => {
	vi.useFakeTimers();
	const store = useNotificationsStore();
	const { queue, dialogs } = useNotices();

	const a = store.add({ title: 'a', persist: true });
	vi.advanceTimersByTime(1);
	const b = store.add({ title: 'b', dialog: true });
	vi.advanceTimersByTime(1);
	const c = store.add({ title: 'c' });
	expect(store.queue.map((n) => n.title)).toEqual(['a', 'c']);
	expect(store.dialogs.map((n) => n.title)).toEqual(['b']);

	store.update(a, { title: 'a2' });
	expect(queue.value[0]?.title).toBe('a2');

	store.hide(a);
	expect(store.previous.map((n) => n.title)).toEqual(['a2']);
	expect(store.lastFour.map((n) => n.title)).toEqual(['a2', 'c']);

	store.remove(b);
	expect(dialogs.value).toEqual([]);
	vi.advanceTimersByTime(3000);
	expect(store.lastFour.map((n) => n.title)).toEqual(['a2']);
	expect(queue.value.find((n) => n.id === c)).toBeUndefined();

	store.setOverlayIsActive(true);
	expect([store.overlayIsActive, store.notifications]).toEqual([true, []]);
	vi.useRealTimers();
});
