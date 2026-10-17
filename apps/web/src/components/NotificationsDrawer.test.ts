// Spec 018 US6 (T091; FR-071 to FR-077, R-57, recipe Q-39) on the fixture API with the 3 admin notifications: no request
// while closed; opening lists the Inbox (#201); tab change clears the selection and loads the Archive; select one / all
// (indeterminate); Archive and Unarchive (#202, then #201 and #26); Delete with confirmation (#203); errors of the list,
// Archive and Delete open the error dialog (Archive keeps the selection, Delete clears it and closes the dialog); 10
// skeleton rows while loading; no refresh while open; the three FR-072 targets (singleton by meta.singleton) and none;
// opening a target closes the drawer; md(message) sanitized; search (highlight `mark`); empty states; pagination by 25;
// the Activity link. Axe checks of the two tabs in light and dark are left to the E2E (T096): this is a happy-dom test.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { resetNotices, useNotices } from '../composables/use-notices.ts';
import { useAppStore } from '../stores/app.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useUserStore } from '../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { mountLayout } from '../test-utils/layout.ts';
import NotificationsDrawer from './NotificationsDrawer.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

let fetch: ReturnType<typeof mockFixtureApi>;
// The stores of the mounted app, taken while its pinia is the active one (another test's late work may change it).
let appStore: ReturnType<typeof useAppStore>;
let notificationsStore: ReturnType<typeof useNotificationsStore>;
let collectionsStore: ReturnType<typeof useCollectionsStore>;
const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

type Row = Record<string, unknown>;

const extra = (id: number, values: Row = {}): Row => ({
	id,
	recipient: 'bo-1',
	timestamp: '2026-09-01T00:00:00.000Z',
	subject: `bo_extra_${id}`,
	message: null,
	collection: null,
	item: null,
	status: 'inbox',
	...values,
});

async function setup({ open = true, rows = [] as Row[] } = {}) {
	const mounted = await mountLayout(
		{ render: () => h(NotificationsDrawer) },
		{
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), { user: 'admin' });
				fetch.db['directus_notifications']!.push(...rows);
				appStore = useAppStore();
				notificationsStore = useNotificationsStore();
				collectionsStore = useCollectionsStore();
				await useUserStore().hydrate();
				await Promise.all([useFieldsStore().hydrate(), collectionsStore.hydrate()]);
				fetch.mockClear();
			},
		},
	);

	if (open) await openDrawer();
	return mounted;
}

async function openDrawer() {
	const before = listCalls().length;
	appStore.notificationsDrawerOpen = true;
	// The list request is throttled by useItems (500 ms after the previous one).
	await vi.waitFor(() => expect(listCalls().length).toBeGreaterThan(before), { timeout: 2000 });
	await settle();
}

async function settle() {
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await flushPromises();
}

/** Fails the next list request (GET with `fields`) with a 500. */
function failNextList() {
	const route = fetch.getMockImplementation()!;
	let failed = false;
	fetch.mockImplementation(async (input, init) => {
		if (!failed && String(input).includes('fields=')) {
			failed = true;
			return boom();
		}
		return route(input, init);
	});
}

const boom = () => json({ errors: [{ message: 'Boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }, 500);

const listCalls = () => calls(fetch).filter((c) => c.startsWith('GET /notifications') && c.includes('fields='));
const subjects = () =>
	[...document.querySelectorAll('[data-notification]')].map((li) =>
		li.querySelector('span.truncate')!.textContent!.trim(),
	);
const row = (subject: string) =>
	[...document.querySelectorAll<HTMLElement>('[data-notification]')].find((li) => li.textContent!.includes(subject))!;
const rowCheckbox = (subject: string) => row(subject).querySelector<HTMLButtonElement>('[role="checkbox"]')!;
const selectAll = () => document.querySelector<HTMLButtonElement>('[role="dialog"] [role="checkbox"]')!;
const button = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.getAttribute('aria-label') === label);
const bodies = (method: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === '/notifications')
		.map(([, init]) => JSON.parse(String(init!.body)));
const errorDialogs = () => useNotices().dialogs.value;

async function click(el: HTMLElement) {
	el.click();
	await flushPromises();
}

async function switchTab(name: string) {
	const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) => el.textContent!.includes(name))!;
	tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
	await flushPromises();
}

describe('NotificationsDrawer', () => {
	test('no request while closed; opening lists the Inbox of the current user (#201)', async () => {
		await setup({ open: false });
		expect(calls(fetch)).toEqual([]);

		await openDrawer();
		const [list] = listCalls();
		expect(list).toContain('"recipient":{"_eq":"bo-1"}');
		expect(list).toContain('"status":{"_eq":"inbox"}');
		expect(list).toContain('fields=id,subject,message,collection,item,timestamp');
		expect(list).toContain('sort=-timestamp');
		expect(list).toContain('limit=25');
		expect(list).toContain('page=1');
		expect(subjects()).toEqual(['bo_notification_collection', 'bo_notification_item', 'bo_notification_path']);
		expect(document.querySelector('[data-notifications-drawer]')).not.toBeNull();
		expect(document.querySelector('[role="dialog"]')!.textContent).toContain(t('item_count', { count: 3 }, 3));
	});

	test('no refresh while open: a new notification only shows after reopening', async () => {
		await setup();
		const count = calls(fetch).length;
		fetch.db['directus_notifications']!.push(extra(10));
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(calls(fetch).length).toBe(count);

		appStore.notificationsDrawerOpen = false;
		await flushPromises();
		await openDrawer();
		await vi.waitFor(() => expect(subjects()).toContain('bo_extra_10'));
	});

	test('FR-072 targets: collection, item, path, singleton by meta.singleton, none; opening one closes the drawer', async () => {
		const { router } = await setup({ rows: [extra(10)] });
		const target = (subject: string) =>
			row(subject).querySelector(`button[aria-label="${t('goto_collection_content')}"]`);

		expect(target('bo_notification_collection')).not.toBeNull();
		expect(target('bo_extra_10')).toBeNull();

		await click(target('bo_notification_item') as HTMLElement);
		expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/1');
		expect(appStore.notificationsDrawerOpen).toBe(false);

		await openDrawer();
		await click(target('bo_notification_path') as HTMLElement);
		expect(router.currentRoute.value.fullPath).toBe('/settings/project');

		await openDrawer();
		await click(target('bo_notification_collection') as HTMLElement);
		expect(router.currentRoute.value.fullPath).toBe('/content/bo_content');

		await openDrawer();
		collectionsStore.getCollection('bo_content')!.meta!.singleton = true;
		await flushPromises();
		await click(target('bo_notification_item') as HTMLElement);
		expect(router.currentRoute.value.fullPath).toBe('/content/bo_content');
	});

	test('expand shows md(message) sanitized; rows without a message have no expand button', async () => {
		// Separate rows: happy-dom's NodeIterator stops after DOMPurify removes a <script> (see utils/markdown.test.ts).
		await setup({
			rows: [
				extra(10, { message: 'x <script>alert(1)</script>' }),
				extra(11, { message: '<img src="x" onerror="alert(1)">' }),
			],
		});

		expect(row('bo_notification_collection').querySelector('button[aria-expanded]')).toBeNull();

		const expand = row('bo_notification_item').querySelector<HTMLButtonElement>('button[aria-expanded]')!;
		expect(expand.getAttribute('aria-expanded')).toBe('false');
		await click(expand);
		expect(expand.getAttribute('aria-expanded')).toBe('true');
		const message = row('bo_notification_item').querySelector(`#${CSS.escape(expand.getAttribute('aria-controls')!)}`)!;
		expect(message.querySelector('strong')!.textContent).toBe('item');
		const link = message.querySelector('a')!;
		expect(link.getAttribute('href')).toBe('/admin/content/bo_content/1');
		// Same origin: md() of 013 sets no target (Directus `_self`, research T001 (i)).
		expect(link.getAttribute('target')).toBeNull();

		await click(row('bo_extra_10').querySelector<HTMLButtonElement>('button[aria-expanded]')!);
		await click(row('bo_extra_11').querySelector<HTMLButtonElement>('button[aria-expanded]')!);
		expect(row('bo_extra_10').innerHTML).not.toContain('<script');
		expect(row('bo_extra_11').innerHTML).not.toContain('onerror');
		expect(row('bo_extra_11').querySelector('img')).not.toBeNull();
	});

	test('select one, then all (indeterminate in between); tab change clears it and loads the Archive', async () => {
		await setup();
		const archive = button(t('archive'))!;
		expect(archive.disabled).toBe(true);
		expect(button(t('delete_label'))!.disabled).toBe(true);

		await click(rowCheckbox('bo_notification_item'));
		expect(rowCheckbox('bo_notification_item').getAttribute('aria-checked')).toBe('true');
		expect(selectAll().getAttribute('aria-checked')).toBe('mixed');
		expect(archive.disabled).toBe(false);

		await click(selectAll());
		expect(selectAll().getAttribute('aria-checked')).toBe('true');
		expect(document.querySelectorAll('[data-notification] [aria-checked="true"]')).toHaveLength(3);
		await click(selectAll());
		expect(document.querySelectorAll('[data-notification] [aria-checked="true"]')).toHaveLength(0);

		await click(rowCheckbox('bo_notification_item'));
		await switchTab(t('archive'));
		await vi.waitFor(() => expect(listCalls().some((c) => c.includes('"status":{"_eq":"archived"}'))).toBe(true));
		await vi.waitFor(() => expect(document.body.textContent).toContain(t('no_notifications')));
		expect(button(t('unarchive'))!.disabled).toBe(true);
	});

	test('Archive then Unarchive: PATCH (#202), then the list (#201) and the unread count (#26)', async () => {
		await setup();
		await notificationsStore.refreshUnreadCount();
		expect(notificationsStore.unread).toBe(3);
		fetch.mockClear();

		await click(rowCheckbox('bo_notification_item'));
		await click(button(t('archive'))!);
		await vi.waitFor(() => expect(subjects()).not.toContain('bo_notification_item'));

		expect(bodies('PATCH')).toEqual([{ keys: [2], data: { status: 'archived' } }]);
		const after = calls(fetch).slice(1);
		expect(after.some((c) => c.includes('fields='))).toBe(true);
		expect(after.some((c) => c.includes('aggregate={"count":"id"}'))).toBe(true);
		// D-115: the drawer's own counts are recounted after the write (Directus reuses the memoized ones).
		// (`count: *` here: the fixture fields store has no primary key for directus_notifications.)
		expect(
			after.some((c) => /aggregate=\{"(countDistinct|count)":"(id|\*)"\}/.test(c) && !c.includes('"count":"id"')),
		).toBe(true);
		expect(notificationsStore.unread).toBe(2);
		expect(rowCheckbox('bo_notification_path').getAttribute('aria-checked')).toBe('false');

		await switchTab(t('archive'));
		await vi.waitFor(() => expect(subjects()).toEqual(['bo_notification_item']));
		await click(rowCheckbox('bo_notification_item'));
		await click(button(t('unarchive'))!);
		await vi.waitFor(() => expect(subjects()).toEqual([]));
		expect(bodies('PATCH')[1]).toEqual({ keys: [2], data: { status: 'inbox' } });
		expect(notificationsStore.unread).toBe(3);
	});

	test('Delete asks for confirmation, then DELETE { keys } as Directus (#203)', async () => {
		await setup();
		await click(rowCheckbox('bo_notification_path'));
		await click(button(t('delete_label'))!);

		const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) =>
			d.textContent!.includes(t('delete_are_you_sure')),
		)!;
		expect(dialog).toBeDefined();
		expect(bodies('DELETE')).toEqual([]);

		await click(
			[...dialog.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
				b.textContent!.includes(t('delete_label')),
			)!,
		);
		await vi.waitFor(() => expect(subjects()).toEqual(['bo_notification_collection', 'bo_notification_item']));
		expect(bodies('DELETE')).toEqual([{ keys: [3] }]);
		expect(document.body.textContent).not.toContain(t('delete_are_you_sure'));
		expect(errorDialogs()).toEqual([]);
	});

	test('errors (R-57): list error dialog; Archive keeps the selection; Delete clears it and closes the dialog', async () => {
		await setup({ open: false });
		failNextList();
		appStore.notificationsDrawerOpen = true;
		await vi.waitFor(() => expect(errorDialogs()).toHaveLength(1));
		expect(errorDialogs()[0]!.code).toBe('INTERNAL_SERVER_ERROR');
		resetNotices();
		appStore.notificationsDrawerOpen = false;
		await flushPromises();
		await openDrawer();

		await click(rowCheckbox('bo_notification_item'));
		fetch.mockImplementationOnce(async () => boom());
		await click(button(t('archive'))!);
		await vi.waitFor(() => expect(errorDialogs()).toHaveLength(1));
		expect(rowCheckbox('bo_notification_item').getAttribute('aria-checked')).toBe('true');
		resetNotices();

		await click(button(t('delete_label'))!);
		fetch.mockImplementationOnce(async () => boom());
		const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1)!;
		await click(
			[...dialog.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
				b.textContent!.includes(t('delete_label')),
			)!,
		);
		await vi.waitFor(() => expect(errorDialogs()).toHaveLength(1));
		expect(document.body.textContent).not.toContain(t('delete_are_you_sure'));
		expect(rowCheckbox('bo_notification_item').getAttribute('aria-checked')).toBe('false');
		expect(subjects()).toHaveLength(3);
	});

	test('10 skeleton rows while the list loads', async () => {
		await setup({ open: false });
		const route = fetch.getMockImplementation()!;
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		fetch.mockImplementation(async (input, init) => {
			if (String(input).includes('fields=')) await held;
			return route(input, init);
		});

		appStore.notificationsDrawerOpen = true;
		await vi.waitFor(() =>
			expect(document.querySelectorAll('[data-testid="notifications-skeleton"] li')).toHaveLength(10),
		);
		release();
		await vi.waitFor(() => expect(subjects()).toHaveLength(3));
		expect(document.querySelector('[data-testid="notifications-skeleton"]')).toBeNull();
	});

	test('search sends `search`, highlights the subject, no match shows no_results with clear filters', async () => {
		await setup();
		// The fixture has no directus_notifications fields to search in: the API answer for "ITEM" is given here.
		const route = fetch.getMockImplementation()!;
		fetch.mockImplementation(async (input, init) => {
			const url = new URL(String(input));
			if (url.searchParams.get('search') !== 'ITEM') return route(input, init);
			const rows = fetch.db['directus_notifications']!.filter((r) => r['id'] === 2);
			return json({ data: url.searchParams.has('aggregate') ? [{ count: rows.length }] : rows });
		});
		const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="search"]')!;
		input.value = 'ITEM';
		input.dispatchEvent(new Event('input'));
		await vi.waitFor(() => expect(listCalls().some((c) => c.includes('search=ITEM'))).toBe(true));
		await vi.waitFor(() => expect(subjects()).toEqual(['bo_notification_item']));
		expect(row('bo_notification_item').querySelector('mark')!.textContent).toBe('item');

		input.value = 'nothing-matches';
		input.dispatchEvent(new Event('input'));
		await vi.waitFor(() => expect(document.body.textContent).toContain(t('no_results')));
		await click(
			[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
				b.textContent!.includes(t('clear_filters')),
			)!,
		);
		await vi.waitFor(() => expect(subjects()).toHaveLength(3));
	});

	test('empty Inbox shows no_notifications', async () => {
		await setup({ open: false });
		fetch.db['directus_notifications'] = [];
		await openDrawer();
		expect(document.body.textContent).toContain(t('no_notifications'));
		expect(document.body.textContent).toContain(t('no_notifications_copy'));
	});

	test('pages of 25 with BoPagination', async () => {
		await setup({ rows: Array.from({ length: 27 }, (_, i) => extra(100 + i)) });
		expect(subjects()).toHaveLength(25);

		const nav = document.querySelector('[role="dialog"] nav')!;
		await click([...nav.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === '2')!);
		await vi.waitFor(() => expect(listCalls().some((c) => c.includes('page=2'))).toBe(true));
		await vi.waitFor(() => expect(subjects()).toHaveLength(5));
	});

	test('the Activity link goes to /activity and closes the drawer', async () => {
		const { router } = await setup();
		const link = [...document.querySelectorAll<HTMLAnchorElement>('[role="dialog"] a')].find((a) =>
			a.textContent!.includes(t('activity')),
		)!;
		expect(link.getAttribute('href')).toBe('/activity');

		await click(link);
		expect(appStore.notificationsDrawerOpen).toBe(false);
		expect(router.currentRoute.value.fullPath).toBe('/activity');
	});
});
