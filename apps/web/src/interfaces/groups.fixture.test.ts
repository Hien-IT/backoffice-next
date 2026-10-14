// T089 (contracts/tests.md §4): BoForm on collection bo_groups of the fixture snapshot, fields store hydrated through
// mockFixtureApi, the real registered interfaces and the seeded item: US6 scenarios 1-3.
import type { ValidationError } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import BoForm from '../components/form/BoForm.vue';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
// Item 1 as the item page holds it: the m2o is a key (as in presentation-header/InterfaceHeader.test.ts).
const item = { ...snapshot.items['bo_groups']!.find((row) => row['id'] === 1)!, target: 1 };

let fetch: ReturnType<typeof mockFixtureApi>;
let router: ReturnType<typeof createRouter>;

beforeEach(async () => {
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot);
	await Promise.all([useCollectionsStore().hydrate(), useFieldsStore().hydrate(), useRelationsStore().hydrate()]);
	// What hydrate() of the flows store answers for the admin (#33), without the permissions store.
	useFlowsStore().flows = structuredClone(snapshot.flows);
	router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/content/bo_groups/1');
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.unstubAllGlobals();
});

/** The stored (`$t:` translated) meta of a bo_groups field, to adjust before mounting. */
const meta = (field: string) => useFieldsStore().getField('bo_groups', field)!.meta!;

/** Mounts the bo_groups form like the item screen: v-model on the edits, the seeded item as initial values. */
async function mountForm(props: Record<string, unknown> = {}) {
	const wrapper = mount(BoForm, {
		props: {
			collection: 'bo_groups',
			primaryKey: 1,
			initialValues: item,
			modelValue: {},
			'onUpdate:modelValue': (edits: Record<string, unknown>) => wrapper.setProps({ modelValue: edits }),
			...props,
		},
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>;

const fieldEl = (wrapper: Wrapper, name: string) => wrapper.get(`[data-field="${name}"]`);

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

/** Opens the header "Actions" menu by keyboard and returns its items. */
async function openActions(wrapper: Wrapper) {
	const trigger = fieldEl(wrapper, 'header').get('[data-actions]').element as HTMLElement;
	expect(trigger.textContent).toContain(i18n.global.t('actions'));
	trigger.focus();
	await key(trigger, 'Enter');
	return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

/** The seeded `header` with its flow link and the internal URL link of `header_inline` (no seeded header has both). */
function headerWithInternalAndFlowLinks() {
	const links = meta('header').options!['links'] as Record<string, unknown>[];
	const internal = (meta('header_inline').options!['links'] as Record<string, unknown>[])[0]!;
	meta('header').options!['links'] = [internal, links.find((link) => link['actionType'] === 'flow')!];
}

describe('bo_groups form from the fixture snapshot (US6)', () => {
	test('every group renders with its nested groups; no edit emitted on mount', async () => {
		const wrapper = await mountForm();

		const count = (kind: string) => wrapper.findAll(`[data-group-${kind}]`).length;

		// accordion + accordion_single; detail; raw + acc_group + acc_single_a + tab_one (+ group_null: no interface,
		// so the default of alias); tabs.
		expect([count('accordion'), count('detail'), count('tabs')]).toEqual([2, 1, 1]);
		expect(count('raw')).toBeGreaterThanOrEqual(4);
		// accordion (start opened) shows its nested group-raw child; tabs shows its first tab.
		const values = wrapper.findAll<HTMLInputElement>('input').map((input) => input.element.value);
		expect(values).toEqual(expect.arrayContaining(['Accordion text', 'Inner', 'Raw', 'Tab one']));
		expect(values).not.toContain('Tab two A');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('US6-1: accordion_single (accordionMode true, start first) opens only the first section; an error opens another', async () => {
		const wrapper = await mountForm();
		const sections = () =>
			wrapper
				.findAll('[data-group-accordion] h3 > button')
				.filter((button) => /Acc Single/.test(button.text()))
				.map((button) => [button.text().replace('expand_more', '').trim(), button.attributes('aria-expanded')]);

		expect(sections()).toEqual([
			['Acc Single A', 'true'],
			['Acc Single B', 'false'],
		]);

		// group-accordion.vue checks the errors of its direct children (the sections).
		const error = {
			code: 'FAILED_VALIDATION',
			collection: 'bo_groups',
			field: 'acc_single_b',
			type: 'required',
			hidden: false,
			group: 'accordion_single',
		} as unknown as ValidationError;

		await wrapper.setProps({ validationErrors: [error] });
		expect(sections()).toEqual([
			['Acc Single A', 'false'],
			['Acc Single B', 'true'],
		]);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('US6-2: header with an internal URL link and a flow link: "Actions" menu, router link, flow trigger', async () => {
		headerWithInternalAndFlowLinks();
		const wrapper = await mountForm();
		let items = await openActions(wrapper);

		expect(items.map((el) => el.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Open target', 'boltRun flow']);
		// internal link: a router link (href resolved by the router), navigates in the app
		expect(items[0]!.tagName).toBe('A');
		expect(items[0]!.getAttribute('href')).toBe('/content/bo_rel_target/1');
		expect(items[0]!.hasAttribute('target')).toBe(false);
		items[0]!.click();
		await flushPromises();
		expect(router.currentRoute.value.fullPath).toBe('/content/bo_rel_target/1');

		// flow link: bo-flow confirmation dialog, then POST /flows/trigger/bo-6 (#48)
		items = await openActions(wrapper);
		(items[1] as HTMLElement).focus();
		await key(items[1]!, 'Enter');
		await vi.waitFor(() =>
			expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Run the fixture flow?'),
		);
		const dialog = document.body.querySelector('[role="dialog"]')!;
		const input = dialog.querySelector('input')!;
		input.value = 'Hello';
		input.dispatchEvent(new Event('input'));
		await flushPromises();
		[...dialog.querySelectorAll('button')].find((b) => b.textContent!.includes('Run Flow on Current Item'))!.click();

		await vi.waitFor(() => expect(calls(fetch)).toContain('POST /flows/trigger/bo-6'));
		const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(String(post[1]!.body))).toEqual({ note: 'Hello', collection: 'bo_groups', keys: [1] });
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('US6-2: on a new item ("+") the flow entry is disabled, the URL entry is not', async () => {
		headerWithInternalAndFlowLinks();
		const wrapper = await mountForm({ primaryKey: '+', initialValues: null });
		const items = await openActions(wrapper);

		expect(items).toHaveLength(2);
		expect(items[0]!.hasAttribute('data-disabled')).toBe(false);
		expect(items[1]!.hasAttribute('data-disabled')).toBe(true);
		expect(calls(fetch).some((call) => call.startsWith('POST'))).toBe(false);
	});

	test('US6-3: a readonly group makes every child readonly, through nested groups (FR-014)', async () => {
		// No seeded group is readonly: `tabs` (with the nested group-tabs and group-detail) is made readonly here.
		meta('tabs').readonly = true;
		const wrapper = await mountForm();
		const tabs = wrapper.get('[data-group-tabs]');
		const tabInputs = () => tabs.findAll<HTMLInputElement>('input');

		expect(tabInputs().length).toBeGreaterThan(0);
		expect(tabInputs().every((input) => input.attributes('disabled') !== undefined)).toBe(true);

		// every tab, the nested group-tabs and its group-detail included
		const seen = new Set<string>();
		const visited = new Set<string>();
		let tab;
		// the nested group-tabs only renders once its tab is active, so look for unvisited tabs again after each switch
		while ((tab = tabs.findAll('[role="tab"]').find((el) => !visited.has(el.text())))) {
			visited.add(tab.text());
			await tab.trigger('mousedown', { button: 0, ctrlKey: false });
			await flushPromises();
			expect(tabInputs().every((input) => input.attributes('disabled') !== undefined)).toBe(true);
			for (const input of tabInputs()) seen.add(input.element.value);
		}
		expect([...seen].sort()).toEqual(['Tab one', 'Tab two A', 'Tab two B']);

		// fields outside the group stay editable
		expect(fieldEl(wrapper, 'raw_text').get('input').attributes('disabled')).toBeUndefined();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});
