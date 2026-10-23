// DR has no test for revisions-sidebar-detail.vue / revision-item.vue: FR-080 and FR-081 (count badge, load on
// open, groups and rows, private user, created externally, pagination, comparison modal in revision mode, revert).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { calls, json, mockApi } from '../../test-utils/fetch.ts';
import BoPagination from '../BoPagination.vue';
import RevisionsSidebarDetail from './RevisionsSidebarDetail.vue';

enableAutoUnmount(afterEach);

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

/* eslint-disable vue/require-default-prop -- a stub recording the props it gets */
const ComparisonModal = defineComponent({
	name: 'ComparisonModal',
	props: {
		modelValue: Boolean,
		currentRevision: Object,
		mode: String,
		revisions: Array,
		currentVersion: Object,
		collection: String,
		primaryKey: [String, Number],
		deleteVersionsAllowed: Boolean,
	},
	emits: ['confirm', 'cancel', 'update:modelValue', 'update:currentRevision'],
	setup: () => () => h('div'),
});
/* eslint-enable vue/require-default-prop */

const user = { id: 'u1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace' };
const today = new Date(2026, 9, 15, 9, 5).toISOString();

const rows = [
	{
		id: 3,
		collection: 'bo_content',
		item: '1',
		data: {},
		delta: { title: 'x', body: 'y' },
		activity: { action: 'update', timestamp: today, user },
	},
	{
		id: 2,
		collection: 'bo_content',
		item: '1',
		data: {},
		delta: null,
		activity: { action: 'delete', timestamp: today, user: null },
	},
];

let count = 2;
let created: { id: number }[] = [];

beforeEach(async () => {
	await replaceQueue();
	setActivePinia(createPinia());
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 9, 15, 12));
	count = 2;
	created = [];

	useFieldsStore().fields = ['title', 'body'].map(
		(field) => ({ collection: 'bo_content', field, type: 'string', meta: {}, schema: {} }) as never,
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function api() {
	return mockApi({
		'GET /revisions': ({ url }: { url: URL }) => {
			if (url.searchParams.has('aggregate')) return json({ data: [{ count: { id: String(count) } }] });
			if (url.searchParams.get('fields') === 'id') return json({ data: created });
			return json({ data: rows });
		},
	});
}

async function setup(open = false) {
	if (open) useSidebarStore().activeAccordionItem = 'revisions';
	const wrapper = mount(RevisionsSidebarDetail, {
		props: { collection: 'bo_content', primaryKey: 1, version: null },
		global: { plugins: [i18n, router], stubs: { ComparisonModal } },
	});
	await flushPromises();
	return wrapper;
}

test('closed: reads the count only and shows it as the badge', async () => {
	const fetch = api();
	const wrapper = await setup();

	expect(calls(fetch)).toHaveLength(1);
	expect(calls(fetch)[0]).toContain('aggregate=');
	expect(wrapper.text()).toContain('Revisions');
	expect(wrapper.text()).toContain('2');
});

test('opening the section loads the page: date group, action, time and user, private user', async () => {
	const fetch = api();
	const wrapper = await setup();

	useSidebarStore().activeAccordionItem = 'revisions';
	await flushPromises();

	expect(calls(fetch)).toHaveLength(3);
	const text = wrapper.text();
	expect(text).toContain('Today');
	expect(text).toContain('Updated 2 Fields');
	expect(text).toContain('Ada Lovelace');
	expect(text).toContain('Deleted');
	expect(text).toContain('Private User');
	// no `create` revision: the item was created outside of the app
	expect(text).toContain(String(i18n.global.t('revision_delta_created_externally')));
});

test('no revisions', async () => {
	count = 0;
	api();
	const wrapper = await setup(true);

	expect(wrapper.text()).toContain(String(i18n.global.t('no_revisions')));
});

test('pagination reads the next page', async () => {
	count = 25;
	created = [{ id: 1 }];
	const fetch = api();
	const wrapper = await setup(true);

	const pagination = wrapper.findComponent(BoPagination);
	expect(pagination.props('length')).toBe(3);
	expect(wrapper.text()).not.toContain(String(i18n.global.t('revision_delta_created_externally')));

	fetch.mockClear();
	pagination.vm.$emit('update:modelValue', 2);
	await flushPromises();
	expect(calls(fetch).some((c) => c.includes('page=2'))).toBe(true);
});

test('a row opens the comparison modal in revision mode; confirm emits revert; refresh is exposed', async () => {
	api();
	const wrapper = await setup(true);
	const modal = wrapper.findComponent(ComparisonModal);

	expect(modal.props('modelValue')).toBe(false);
	expect(modal.props('mode')).toBe('revision');
	expect(modal.props('deleteVersionsAllowed')).toBe(false);

	await wrapper.findAll('li button')[0]!.trigger('click');
	expect(modal.props('modelValue')).toBe(true);
	expect(modal.props('currentRevision')?.['id']).toBe(3);
	expect(modal.props('revisions')).toHaveLength(2);

	modal.vm.$emit('confirm', { title: 'x' });
	expect(wrapper.emitted('revert')).toEqual([[{ title: 'x' }]]);

	modal.vm.$emit('cancel');
	await flushPromises();
	expect(modal.props('modelValue')).toBe(false);
	expect(modal.props('currentRevision')).toBeNull();

	// a route change closes the modal
	await wrapper.findAll('li button')[0]!.trigger('click');
	await router.push('/elsewhere');
	await flushPromises();
	expect(modal.props('modelValue')).toBe(false);

	expect(typeof (wrapper.vm as unknown as { refresh: unknown }).refresh).toBe('function');
});

test('a new version (+) reads the revisions of the main item', async () => {
	const fetch = api();
	mount(RevisionsSidebarDetail, {
		props: { collection: 'bo_content', primaryKey: 1, version: { id: '+', key: 'x', name: null, type: 'local' } },
		global: { plugins: [i18n, router], stubs: { ComparisonModal } },
	});
	await flushPromises();

	expect(calls(fetch)[0]).toContain('"version":{"_null":true}');
});
