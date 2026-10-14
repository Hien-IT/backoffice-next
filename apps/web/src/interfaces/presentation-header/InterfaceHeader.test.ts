// Fixture and option tests of `header` (contracts/tests.md §5, FR-057) on bo_groups.header / header_inline, with the
// fixture API (useTemplateData #38, flow trigger #48 through the default run-manual-flow and FlowDialogs).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useFlowsStore } from '../../stores/flows.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import InterfaceHeader from './InterfaceHeader.vue';

// The flow dialog's form is a lazy component (import cycle with the interface registry): load it once up front.
beforeAll(() => import('../../components/form/BoForm.vue'));

let fetch: ReturnType<typeof mockFixtureApi>;

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

// Form values of item 1 as the item page holds them: the m2o is a key.
const values = () => ({ ...itemOf('bo_groups', 1), target: 1 });

/** Field options as the fields store holds them (`$t:` translated). */
const options = (field: string) => useFieldsStore().getField('bo_groups', field)!.meta!.options!;

beforeEach(async () => {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	const snapshot = loadSnapshot();
	fetch = mockFixtureApi(snapshot);
	await Promise.all([useCollectionsStore().hydrate(), useFieldsStore().hydrate(), useRelationsStore().hydrate()]);
	useFlowsStore().flows = snapshot.flows;
	fetch.mockClear();
});

afterEach(() => {
	document.body.innerHTML = '';
});

function mountHeader(props: Record<string, unknown>, provide: Record<string | symbol, unknown> = {}) {
	return mount(InterfaceHeader, {
		props: { collection: 'bo_groups', field: 'header', type: 'alias', value: null, primaryKey: 1, ...props },
		attachTo: document.body,
		global: { plugins: [i18n, router], provide: { values: ref(values()), ...provide } },
	});
}

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

describe('header (fixture bo_groups)', () => {
	test('title and subtitle render over the form values, relational values fetched (#38); no input', async () => {
		const wrapper = mountHeader(options('header'));
		await vi.waitFor(() => expect(wrapper.get('[data-subtitle]').text()).toBe('Item 1 - Target one'));

		expect(wrapper.get('[data-title]').text()).toContain('Group item');
		expect(calls(fetch)).toEqual(['GET /items/bo_groups/1?fields=title,id,target.name,id']);
		assertOnlyKnownRequests(calls(fetch));
		expect(wrapper.emitted('input')).toBeUndefined();
		wrapper.unmount();
	});

	test('option:header.icon and option:header.color: icon before the title, colored by style', () => {
		const wrapper = mountHeader(options('header'));
		const icon = wrapper.get('[data-title] .material-symbols-rounded');

		expect(icon.text()).toBe('flag');
		expect(icon.attributes('style')).toContain('color');
		wrapper.unmount();
	});

	test('option:header.help with option:header.helpDisplayMode modal: help in a dialog, sanitized', async () => {
		const wrapper = mountHeader({
			...options('header'),
			help: '<p>Some <strong>help</strong></p><img src=x onerror=alert(1)>',
		});
		const button = wrapper.get('[data-help-button]');

		expect(button.attributes('aria-label')).toBe('Help');
		expect(button.attributes('aria-haspopup')).toBe('dialog');

		await button.trigger('click');
		await flushPromises();
		const dialog = document.body.querySelector('[role="dialog"]')!;

		expect(dialog.querySelector('strong')!.textContent).toBe('help');
		expect(dialog.querySelector('img')!.hasAttribute('onerror')).toBe(false);
		wrapper.unmount();
	});

	test('option:header.helpDisplayMode inline (default): expandable region, Collapse closes it', async () => {
		const wrapper = mountHeader({ help: '<p>Inline help</p>' });
		const button = wrapper.get('[data-help-button]');

		expect(button.attributes('aria-expanded')).toBe('false');
		await button.trigger('click');
		expect(button.attributes('aria-expanded')).toBe('true');
		const region = wrapper.get('[data-help-inline]');
		expect(button.attributes('aria-controls')).toBe(region.attributes('id'));
		expect(region.text()).toContain('Inline help');

		await region.get('button').trigger('click');
		expect(wrapper.find('[data-help-inline]').exists()).toBe(false);
		wrapper.unmount();
	});

	test('option:header.enableHelpTranslations with option:header.helpTranslationsString replace the help', async () => {
		const wrapper = mountHeader({ ...options('header_inline'), help: '<p>Original</p>' });

		await wrapper.get('[data-help-button]').trigger('click');
		const region = wrapper.get('[data-help-inline] .helper-text').text();
		expect(region).toBe(i18n.global.t('interfaces.presentation-notice.description'));
		wrapper.unmount();
	});

	test('option:header.links: one external link is a button, URL rendered over the values, new tab', () => {
		const wrapper = mountHeader({ links: [options('header')['links'][0]] });
		const link = wrapper.get('.actions-container a.action');

		expect(link.attributes('href')).toBe('https://example.com/1');
		expect(link.attributes('target')).toBe('_blank');
		expect(link.attributes('rel')).toBe('noopener noreferrer');
		expect(link.text()).toBe('linkDocs'); // icon ligature + label
		expect(link.classes()).toContain('bg-brand-500');
		wrapper.unmount();
	});

	test('one internal link renders no button, as Directus (no href, no flow)', () => {
		const wrapper = mountHeader(options('header_inline'));

		expect(wrapper.findAll('.actions-container .action')).toHaveLength(0);
		wrapper.unmount();
	});

	test('several links: "Actions" menu by keyboard; internal link is a router link', async () => {
		const links = [...options('header')['links'], options('header_inline')['links'][0]];
		const wrapper = mountHeader({ links });
		const trigger = wrapper.get('[data-actions]').element as HTMLElement;

		expect(trigger.textContent).toContain('Actions');
		trigger.focus();
		await key(trigger, 'Enter');
		const items = [...document.body.querySelectorAll('[role="menuitem"]')];

		// icon ligature + label
		expect(items.map((item) => item.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
			'link Docs',
			'boltRun flow',
			'Open target',
		]);
		expect(items[0]!.getAttribute('href')).toBe('https://example.com/1');
		expect(items[0]!.getAttribute('rel')).toBe('noopener noreferrer');
		expect(items[2]!.getAttribute('href')).toBe('/content/bo_rel_target/1');

		// Enter on the flow item runs it: the bo-flow confirmation dialog opens.
		(items[1] as HTMLElement).focus();
		await key(items[1]!, 'Enter');
		await vi.waitFor(() =>
			expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Run the fixture flow?'),
		);
		wrapper.unmount();
	});

	test('a flow link runs the flow: confirmation form, POST #48, success notice, `ran` emitted', async () => {
		const wrapper = mountHeader({ links: [options('header')['links'][1]] });

		await wrapper.get('.actions-container .action').trigger('click');
		await flushPromises();
		const dialog = document.body.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain('Run the fixture flow?');

		const confirm = [...dialog.querySelectorAll('button')].find((b) =>
			b.textContent!.includes('Run Flow on Current Item'),
		)!;
		expect(confirm.disabled).toBe(true);

		const input = dialog.querySelector('input')!;
		input.value = 'Hello';
		input.dispatchEvent(new Event('input'));
		await flushPromises();
		expect(confirm.disabled).toBe(false);
		confirm.click();

		await vi.waitFor(() => expect(wrapper.emitted('ran')).toHaveLength(1), 2000);
		const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(String(post[1]!.body))).toEqual({ note: 'Hello', collection: 'bo_groups', keys: [1] });
		assertOnlyKnownRequests(calls(fetch));
		await flushPromises();
		expect(wrapper.get('[role="status"]').text()).toContain('Flow "bo-flow" triggered successfully');
		wrapper.unmount();
	});

	test('flow buttons are disabled on a new item and when nonEditable; url links stay enabled', async () => {
		const links = [options('header')['links'][1]];
		const wrapper = mountHeader({ links, primaryKey: '+' });

		expect(wrapper.get('.action').attributes('disabled')).toBe('');
		await wrapper.setProps({ primaryKey: 1, nonEditable: true, disabled: true });
		expect(wrapper.get('.action').attributes('disabled')).toBe('');
		await wrapper.setProps({ links: [options('header')['links'][0]] });
		expect(wrapper.get('.action').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});

	test('form field ids are put on the header', () => {
		const a11y = computed(() => ({ inputId: 'f-1', labelId: 'f-1-label', describedBy: 'f-1-note', invalid: false }));
		const wrapper = mountHeader({ title: 'T' }, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.attributes('id')).toBe('f-1');
		expect(wrapper.attributes('aria-describedby')).toBe('f-1-note');
		wrapper.unmount();
	});
});
