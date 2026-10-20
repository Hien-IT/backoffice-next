// Owner 2026-10-21 (D-132): the bell panel on the fixture API with the 3 admin notifications: the inbox rows with their
// targets, mark one as read (PATCH keys), mark all as read (PATCH by query), the unread count recounted, the empty
// state, "View all".
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../api/sdk.ts';
import { resetNotices } from '../composables/use-notices.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useUserStore } from '../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { mountLayout } from '../test-utils/layout.ts';
import NotificationsPanel from './NotificationsPanel.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

let fetch: ReturnType<typeof mockFixtureApi>;
let notificationsStore: ReturnType<typeof useNotificationsStore>;

async function setup() {
	const mounted = await mountLayout(NotificationsPanel, {
		async beforeMount() {
			fetch = mockFixtureApi(loadSnapshot(), { user: 'admin' });
			notificationsStore = useNotificationsStore();
			await useUserStore().hydrate();
			await Promise.all([useFieldsStore().hydrate(), useCollectionsStore().hydrate()]);
			fetch.mockClear();
		},
	});
	await vi.waitFor(() => expect(document.querySelectorAll('li').length).toBeGreaterThan(0));
	return mounted;
}

const rows = () => [...document.querySelectorAll('li')];
const subjects = () => rows().map((li) => li.querySelector('span.truncate')!.textContent!.trim());
const patches = () =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === 'PATCH' && new URL(String(input)).pathname === '/notifications')
		.map(([, init]) => JSON.parse(String(init!.body)));

test('lists the inbox with targets and recounts on open; mark one, then all, as read', async () => {
	const { wrapper } = await setup();

	expect(subjects().sort()).toEqual(['bo_notification_collection', 'bo_notification_item', 'bo_notification_path']);
	await vi.waitFor(() => expect(notificationsStore.unread).toBe(3));
	const hrefs = rows().map((li) => li.querySelector('a')?.getAttribute('href'));
	expect(hrefs.sort()).toEqual(['/content/bo_content', '/content/bo_content/1', '/settings/project']);

	const item = rows().find((li) => li.textContent!.includes('bo_notification_item'))!;
	item.querySelector<HTMLButtonElement>('button[title="Mark as read"]')!.click();
	await vi.waitFor(() => expect(subjects()).not.toContain('bo_notification_item'));
	expect(patches()).toEqual([{ keys: [2], data: { status: 'archived' } }]);
	await vi.waitFor(() => expect(notificationsStore.unread).toBe(2));

	document.querySelector<HTMLButtonElement>('[data-testid="notifications-mark-all"]')!.click();
	await vi.waitFor(() => expect(rows()).toHaveLength(0));
	expect(patches()[1]).toEqual({
		query: { filter: { _and: [{ recipient: { _eq: 'bo-1' } }, { status: { _eq: 'inbox' } }] }, limit: -1 },
		data: { status: 'archived' },
	});
	await vi.waitFor(() => expect(notificationsStore.unread).toBe(0));
	expect(wrapper.text()).toContain('No Notifications');
	expect(document.querySelector<HTMLButtonElement>('[data-testid="notifications-mark-all"]')!.disabled).toBe(true);
});

test('"View all" asks for the drawer; opening a target asks to close', async () => {
	const { wrapper } = await setup();

	[...document.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'View all')!.click();
	expect(wrapper.emitted('viewAll')).toHaveLength(1);

	rows()[0]!.querySelector('a')!.click();
	await flushPromises();
	expect(wrapper.emitted('close')).toHaveLength(1);
});
