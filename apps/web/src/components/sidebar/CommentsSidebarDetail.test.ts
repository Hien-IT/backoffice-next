// Directus has no test for comments-sidebar-detail.vue, comment-input.vue, comment-item.vue or comment-item-header.vue:
// the Comments section (FR-082, FR-110b, recipe Q-11, contracts/api-calls.md #59, #60, #84-#86) on the fixture API.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetNotices, useNotices } from '../../composables/use-notices.ts';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import BoMenu from '../BoMenu.vue';
import CommentInput from './CommentInput.vue';
import CommentsSidebarDetail from './CommentsSidebarDetail.vue';

const VICTOR = '0b7a3c1e-2f4d-4a5b-8c6d-7e8f9a0b1c2d';
const TODAY = new Date().toISOString();

let fetch: ReturnType<typeof mockFixtureApi>;

enableAutoUnmount(afterEach);

beforeEach(() => {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	resetNotices();
	// The API sets date_created; the fixture API does not.
	fetch = mockFixtureApi(loadSnapshot(), {
		answers: {
			'POST /comments': ({ init }: { init: RequestInit }) => {
				const row = { id: 'c9', ...JSON.parse(String(init.body)), date_created: new Date().toISOString() };
				fetch.db['directus_comments']!.push(row);
				return json({ data: row });
			},
		},
	});
	fetch.db['directus_users']!.push({ id: VICTOR, first_name: 'Victor', last_name: '<b>Viewer</b>', email: 'v@x.test' });
	fetch.db['directus_comments'] = [
		{
			id: 'c1',
			collection: 'bo_content',
			item: '1',
			comment: 'First <img src=x onerror=alert(1)>comment',
			date_created: '2020-01-05T10:00:00Z',
		},
		{ id: 'c2', collection: 'bo_content', item: '1', comment: `Please review @${VICTOR}`, date_created: TODAY },
		{ id: 'c3', collection: 'bo_std', item: '1', comment: 'Other item', date_created: TODAY },
	];
});

afterEach(() => vi.useRealTimers());

async function setup(open = true) {
	useSidebarStore().activeAccordionItem = open ? 'comments' : null;
	const wrapper = mount(CommentsSidebarDetail, {
		props: { collection: 'bo_content', primaryKey: '1' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await vi.waitFor(() => expect(calls(fetch).length).toBeGreaterThanOrEqual(1), 2000);
	if (open) await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(2), 2000);
	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof setup>>;

const textarea = (wrapper: Wrapper) => wrapper.findComponent(CommentInput).get('textarea');

async function type(wrapper: Wrapper, value: string) {
	await textarea(wrapper).setValue(value);
}

function key(wrapper: Wrapper, key: string, init: KeyboardEventInit = {}) {
	return textarea(wrapper).trigger('keydown', { key, ...init });
}

describe('CommentsSidebarDetail', () => {
	test('count badge, date groups newest first, mentions as <mark> with the escaped name, no other HTML', async () => {
		const wrapper = await setup();

		expect(wrapper.get('button').text()).toMatch(/^chat_bubble_outline\s*Comments\s*2/);
		expect(wrapper.findAll('section h3').map((h) => h.text())).toEqual(['Today', 'Jan 5, 2020']);

		const [mention, first] = wrapper.findAll('article p').map((p) => p.element.innerHTML);
		expect(mention).toBe(
			'Please review <mark class="rounded bg-brand-50 px-1 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">Victor &lt;b&gt;Viewer&lt;/b&gt;</mark>',
		);
		expect(first).toBe('First comment');
		expect(wrapper.find('article img').exists()).toBe(false);

		const list = calls(fetch);
		assertOnlyKnownRequests(list);
		expect(list).toEqual([
			'GET /comments?filter={"_and":[{"collection":{"_eq":"bo_content"}},{"item":{"_eq":"1"}}]}&aggregate={"count":"id"}',
			'GET /comments?fields=id,comment,date_created,user_created.id,user_created.email,user_created.first_name,user_created.last_name,user_created.avatar.id,user_created.avatar.modified_on&sort=-date_created&filter[collection][_eq]=bo_content&filter[item][_eq]=1',
			`GET /users?fields=first_name,last_name,email,id&filter={"id":{"_in":["${VICTOR}"]}}`,
		]);
	});

	test('loads the list only when the section opens', async () => {
		const wrapper = await setup(false);
		expect(calls(fetch)).toHaveLength(1);

		useSidebarStore().activeAccordionItem = 'comments';
		await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(2), 2000);
	});

	test('Ctrl/Cmd + Enter posts the comment, refreshes and shows a notice', async () => {
		const wrapper = await setup();

		await key(wrapper, 'Enter', { ctrlKey: true });
		expect(calls(fetch).filter((c) => c.startsWith('POST'))).toEqual([]);

		await type(wrapper, 'New one');
		await key(wrapper, 'Enter', { metaKey: true });

		await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(3), 2000);
		const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(String(post[1]!.body))).toEqual({ collection: 'bo_content', item: '1', comment: 'New one' });
		expect(useNotices().queue.value.map((n) => [n.title, n.type])).toEqual([['Comment posted', 'success']]);
		expect((textarea(wrapper).element as HTMLTextAreaElement).value).toBe('');
	});

	test('typing @ suggests users in a listbox; arrows, Enter insert ` @<uuid>`; Esc closes', async () => {
		const wrapper = await setup();
		fetch.mockClear();

		await type(wrapper, 'Hi @Vi');
		await vi.waitFor(() => expect(wrapper.find('[role="listbox"]').exists()).toBe(true), 2000);

		expect(calls(fetch)).toEqual([
			'GET /users?fields=first_name,last_name,email,id,avatar.id,avatar.modified_on&filter={"_or":[{"first_name":{"_starts_with":"Vi"}},{"last_name":{"_starts_with":"Vi"}},{"email":{"_starts_with":"Vi"}}]}',
		]);

		const options = () => wrapper.findAll('[role="option"]');
		const names = options().map((o) => o.get('.flex-1').text());
		expect(names.includes('Victor Viewer')).toBe(true);
		expect(names.includes('Victor <b>Viewer</b>')).toBe(true);

		const input = textarea(wrapper);
		expect(input.attributes('aria-controls')).toBe(wrapper.get('[role="listbox"]').attributes('id'));
		expect(input.attributes('aria-activedescendant')).toBe(options()[0]!.attributes('id'));

		await key(wrapper, 'ArrowDown');
		expect(options()[1]!.attributes('aria-selected')).toBe('true');
		expect(input.attributes('aria-activedescendant')).toBe(options()[1]!.attributes('id'));
		await key(wrapper, 'ArrowUp');
		await key(wrapper, 'ArrowUp');
		expect(options()[0]!.attributes('aria-selected')).toBe('true');

		const target = names.indexOf('Victor <b>Viewer</b>');
		for (let i = 0; i < target; i++) await key(wrapper, 'ArrowDown');
		await key(wrapper, 'Enter');

		expect((input.element as HTMLTextAreaElement).value).toBe(`Hi @${VICTOR}`);
		expect(wrapper.find('[role="listbox"]').exists()).toBe(false);

		await type(wrapper, '@');
		await vi.waitFor(() => expect(wrapper.find('[role="listbox"]').exists()).toBe(true), 2000);
		await key(wrapper, 'Escape');
		expect(wrapper.find('[role="listbox"]').exists()).toBe(false);

		// A click on an option inserts too; the mention at the start gets its leading space.
		await type(wrapper, '@Ed');
		await vi.waitFor(() => expect(options()).toHaveLength(1), 2000);
		await options()[0]!.trigger('mousedown');
		expect((input.element as HTMLTextAreaElement).value).toBe(' @bo-9');
	});

	test('edit: the menu opens the input with the comment; saving patches it and leaves edit mode', async () => {
		const wrapper = await setup();

		const menu = wrapper.findAllComponents(BoMenu)[0]!;
		expect(menu.props('items').map((i) => i.text)).toEqual(['Edit', 'Delete']);
		menu.props('items')[0]!.onSelect!();
		await flushPromises();

		const editor = wrapper.findAllComponents(CommentInput)[1]!;
		const field = editor.get('textarea');
		expect((field.element as HTMLTextAreaElement).value).toBe(`Please review @${VICTOR}`);

		await field.setValue('Edited');
		await field.trigger('keydown', { key: 'Enter', ctrlKey: true });

		await vi.waitFor(() => expect(wrapper.findAllComponents(CommentInput)).toHaveLength(1), 2000);
		const patch = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
		expect(String(patch[0])).toBe('http://api.test/comments/c2');
		expect(JSON.parse(String(patch[1]!.body))).toEqual({ comment: 'Edited' });
		await vi.waitFor(() => expect(wrapper.text()).toContain('Edited'), 2000);
		expect(useNotices().queue.value.map((n) => n.title)).toEqual(['Comment updated']);
	});

	test('delete asks first; confirming deletes and refreshes the list', async () => {
		const wrapper = await setup();

		wrapper.findAllComponents(BoMenu)[1]!.props('items')[1]!.onSelect!();
		await flushPromises();

		const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(dialog.textContent).toContain('Delete Comment');
		expect(dialog.textContent).toContain('This action is permanent');
		const buttons = [...dialog.querySelectorAll('button')].map((b) => b.textContent?.trim());
		expect(buttons).toEqual(['Cancel', 'Delete']);

		[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();

		await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(1), 2000);
		expect(calls(fetch)).toContain('DELETE /comments/c1');
		expect(document.body.querySelector('[role="dialog"]')).toBeNull();
	});

	test('a failed list load shows the error notice; no comment shows the empty text', async () => {
		fetch.db['directus_comments'] = [];
		const wrapper = await setup(false);
		useSidebarStore().activeAccordionItem = 'comments';
		await vi.waitFor(() => expect(wrapper.text()).toContain('No Comments Yet'), 2000);

		const original = fetch.getMockImplementation()!;
		fetch.mockImplementation(async (input, init) =>
			String(input).includes('sort=')
				? new Response('{"errors":[{"message":"x"}]}', { status: 500 })
				: original(input, init),
		);
		await wrapper.setProps({ primaryKey: '2' });
		await vi.waitFor(() => expect(wrapper.text()).toContain('Unexpected Error'), 2000);
	});
});
