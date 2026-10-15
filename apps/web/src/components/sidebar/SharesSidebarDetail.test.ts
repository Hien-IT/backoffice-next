// Directus has no test for shares-sidebar-detail.vue or share-item.vue: the Shares section (FR-083, recipe Q-11,
// contracts/api-calls.md #61, #87-#90) on the fixture API (share `bo-share` of bo_content item 1).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { resetNotices, useNotices } from '../../composables/use-notices.ts';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import type { AppUser } from '../../types/user.ts';
import BoMenu from '../BoMenu.vue';
import SharesSidebarDetail from './SharesSidebarDetail.vue';

vi.mock('../drawers/DrawerItem.vue', () => ({
	__esModule: true,
	default: defineComponent({
		name: 'DrawerItem',
		props: { collection: { type: String, default: '' }, primaryKey: { type: String, default: null }, active: Boolean },
		emits: ['input', 'update:active'],
		render: () => null,
	}),
}));

let fetch: ReturnType<typeof mockFixtureApi>;

enableAutoUnmount(afterEach);

beforeEach(() => {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	resetNotices();
	useUserStore().currentUser = { id: 'bo-1', admin_access: true } as AppUser;
	fetch = mockFixtureApi(loadSnapshot());
	fetch.db['directus_shares']!.push(
		{
			id: 'bo-30',
			name: 'old',
			collection: 'bo_content',
			item: '1',
			date_end: '2020-01-01T00:00:00Z',
			max_uses: 2,
			times_used: 2,
			password: null,
		},
		{
			id: 'bo-31',
			name: 'later',
			collection: 'bo_content',
			item: '1',
			date_start: '2999-01-01T00:00:00Z',
			max_uses: null,
			times_used: 0,
			password: null,
		},
		{ id: 'bo-32', name: 'elsewhere', collection: 'bo_std', item: '1', max_uses: null, times_used: 0 },
	);
});

afterEach(() => {
	Reflect.deleteProperty(navigator, 'clipboard');
});

async function setup(allowed = true) {
	useSidebarStore().activeAccordionItem = 'shares';
	const wrapper = mount(SharesSidebarDetail, {
		props: { collection: 'bo_content', primaryKey: '1', allowed },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	if (allowed) await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(3), 2000);
	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof setup>>;

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const dialogButton = (text: string) =>
	[...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text)!;

/** Runs the menu item `text` of the share at `index` (sorted by name: bo-share, later, old). */
async function menu(wrapper: Wrapper, index: number, text: string) {
	await vi.waitFor(() => expect(wrapper.findAllComponents(BoMenu)[index]!.props('items').length).toBe(4), 2000);
	wrapper
		.findAllComponents(BoMenu)
		[index]!.props('items')
		.find((i) => i.text === text)!.onSelect!();
	await flushPromises();
}

describe('SharesSidebarDetail', () => {
	test('hidden and silent when not allowed', async () => {
		const wrapper = await setup(false);

		expect(wrapper.html()).toBe('<!--v-if-->');
		expect(calls(fetch)).toEqual([]);
	});

	test('count badge and the list by name with uses left, lock, expired and upcoming states', async () => {
		const wrapper = await setup();

		expect(wrapper.get('button').text()).toMatch(/^share\s*Shares\s*3/);

		const rows = wrapper.findAll('article').map((a) => a.text());
		expect(rows[0]).toMatch(/^bo-share.*5 uses left\s*lock/);
		expect(rows[1]).toMatch(/^later.*Unlimited usage\s*Upcoming/);
		expect(rows[2]).toMatch(/^old.*No uses left\s*Expired/);
		expect(wrapper.findAll('article')[0]!.get('[role="img"]').attributes('aria-label')).toBe('Password');
		expect(wrapper.findAll('article')[2]!.find('.text-error-600').text()).toBe('No uses left');

		const list = calls(fetch);
		assertOnlyKnownRequests(list);
		const filter = '{"_and":[{"collection":{"_eq":"bo_content"}},{"item":{"_eq":"1"}}]}';
		expect(list.slice(0, 2)).toEqual([
			`GET /shares?filter=${filter}&aggregate={"count":"id"}`,
			`GET /shares?filter=${filter}&sort=name`,
		]);
	});

	test('the menu has edit and delete only with the share permissions', async () => {
		useUserStore().currentUser = { id: 'bo-9', admin_access: false } as AppUser;
		usePermissionsStore().permissions = {
			directus_shares: { update: { access: 'partial' }, delete: { access: 'partial' } },
		} as never;
		useSidebarStore().activeAccordionItem = 'shares';
		fetch = mockFixtureApi(loadSnapshot(), {
			answers: {
				'GET /permissions/me/directus_shares/bo-20': {
					update: { access: false },
					delete: { access: true },
					share: { access: false },
				},
			},
		});
		const wrapper = mount(SharesSidebarDetail, {
			props: { collection: 'bo_content', primaryKey: '1', allowed: true },
			global: { plugins: [i18n] },
		});
		await vi.waitFor(() => expect(wrapper.findComponent(BoMenu).props('items')).toHaveLength(3), 2000);
		expect(
			wrapper
				.findComponent(BoMenu)
				.props('items')
				.map((i) => i.text),
		).toEqual(['Copy Link', 'Send Link', 'Delete']);
		expect(calls(fetch)).toContain('GET /permissions/me/directus_shares/bo-20');
	});

	test('copy link writes <origin>/admin/shared/<id> to the clipboard with a notice; no clipboard is an error notice', async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const wrapper = await setup();

		await menu(wrapper, 0, 'Copy Link');
		expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/admin/shared/bo-20`);
		expect(useNotices().queue.value.map((n) => [n.title, n.type])).toEqual([['Link Copied', 'success']]);

		Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
		await menu(wrapper, 0, 'Copy Link');
		expect(useNotices().queue.value.map((n) => [n.title, n.type])[1]).toEqual(['Unable to Copy Link', 'error']);
	});

	test('send link: the dialog shows the link and posts the emails split on commas and new lines', async () => {
		const wrapper = await setup();

		await menu(wrapper, 0, 'Send Link');
		expect(dialog()!.textContent).toContain('Send Link');
		expect(dialog()!.querySelector('input')!.value).toBe(`${window.location.origin}/admin/shared/bo-20`);
		expect(dialog()!.querySelector('input')!.readOnly).toBe(true);

		const emails = dialog()!.querySelector('textarea')!;
		emails.value = 'a@x.test, b@x.test\nc@x.test';
		emails.dispatchEvent(new Event('input'));
		await flushPromises();

		dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
		await vi.waitFor(() => expect(dialog()).toBeNull(), 2000);

		const post = fetch.mock.calls.find(([input]) => String(input).endsWith('/shares/invite'))!;
		expect(post[1]!.method).toBe('POST');
		expect(JSON.parse(String(post[1]!.body))).toEqual({
			emails: ['a@x.test', 'b@x.test', 'c@x.test'],
			share: 'bo-20',
		});
	});

	test('delete asks first; confirming deletes and refreshes', async () => {
		const wrapper = await setup();

		await menu(wrapper, 2, 'Delete');
		expect(dialog()!.textContent).toContain('Delete Share');
		expect([...dialog()!.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Delete']);

		dialogButton('Delete').click();
		await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(2), 2000);
		expect(calls(fetch)).toContain('DELETE /shares/bo-30');
		expect(dialog()).toBeNull();
	});

	test('new and edit open DrawerItem on directus_shares; its input posts or patches with collection and item', async () => {
		const wrapper = await setup();
		const drawer = () => wrapper.findComponent({ name: 'DrawerItem' });
		expect(drawer().exists()).toBe(false);

		await wrapper
			.findAll('button')
			.find((b) => b.text().includes('New Share'))!
			.trigger('click');
		await vi.waitFor(() => expect(drawer().exists()).toBe(true));
		expect(drawer().props()).toMatchObject({ collection: 'directus_shares', primaryKey: '+', active: true });

		drawer().vm.$emit('input', { name: 'new one', max_uses: 3 });
		await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(4), 2000);
		expect(fetch.db['directus_shares']!.at(-1)).toMatchObject({
			name: 'new one',
			max_uses: 3,
			collection: 'bo_content',
			item: '1',
		});
		expect(drawer().exists()).toBe(false);

		await menu(wrapper, 0, 'Edit');
		expect(drawer().props('primaryKey')).toBe('bo-20');
		drawer().vm.$emit('input', { name: 'renamed' });
		await vi.waitFor(() => expect(drawer().exists()).toBe(false), 2000);
		const patch = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
		expect(String(patch[0])).toBe('http://api.test/shares/bo-20');
		expect(JSON.parse(String(patch[1]!.body))).toEqual({ name: 'renamed', collection: 'bo_content', item: '1' });

		await menu(wrapper, 0, 'Edit');
		drawer().vm.$emit('update:active', false);
		await flushPromises();
		expect(drawer().exists()).toBe(false);
	});
});
