// Fixture and option tests of `presentation-links` (contracts/tests.md §5, FR-058) on bo_groups.links with the fixture
// API: relational URL fields fetched with GET <endpoint>/<pk> (#38), flow buttons through the default run (#48).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useFlowsStore } from '../../stores/flows.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import PresentationLinks from './PresentationLinks.vue';

let fetch: ReturnType<typeof mockFixtureApi>;

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

const links = fieldsOf('bo_groups').find((f) => f.field === 'links')!.meta!.options!['links'];

async function setup(answers = {}) {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	const snapshot = loadSnapshot();
	fetch = mockFixtureApi(snapshot, { answers });
	await useFieldsStore().hydrate();
	useFlowsStore().flows = snapshot.flows;
	fetch.mockClear();
}

beforeEach(() => setup());

// The drawer's form is a lazy component (import cycle with the interface registry): load it once up front.
beforeAll(() => import('../../components/form/BoForm.vue'));

afterEach(() => {
	document.body.innerHTML = '';
});

function mountLinks(props: Record<string, unknown>, provide: Record<string | symbol, unknown> = {}) {
	return mount(PresentationLinks, {
		props: { collection: 'bo_groups', field: 'links', type: 'alias', value: null, primaryKey: 1, links, ...props },
		attachTo: document.body,
		global: { plugins: [i18n, router], provide: { values: ref({ ...itemOf('bo_groups', 1), target: 1 }), ...provide } },
	});
}

describe('presentation-links (fixture bo_groups)', () => {
	test('fixture field: relational URL values fetched (#38), URLs over the values, flow shown; no input', async () => {
		const wrapper = mountLinks({});

		await vi.waitFor(() => expect(wrapper.get('a:not([target])').attributes('href')).toBe('/content/bo_rel_target/1'));
		expect(calls(fetch)).toEqual(['GET /items/bo_groups/1?fields=target.id']);
		assertOnlyKnownRequests(calls(fetch));

		const external = wrapper.get('a[target="_blank"]');
		expect(external.attributes('href')).toBe('https://example.com/?title=Group item');
		expect(external.attributes('rel')).toBe('noopener noreferrer');
		expect(external.classes()).toContain('success');
		expect(wrapper.get('button.action').text()).toContain('Run flow');
		expect(wrapper.emitted('input')).toBeUndefined();
		wrapper.unmount();
	});

	test('option:presentation-links.links: only non-array relational values are used', async () => {
		await setup({ 'GET /items/bo_groups/1': { target: { id: 7 }, tags: [{ id: 1 }] } });
		const wrapper = mountLinks({
			links: [
				{ label: 'A', type: 'normal', actionType: 'url', url: '/a/{{ target.id }}' },
				{ label: 'B', type: 'normal', actionType: 'url', url: '/b/{{ tags.id }}' },
			],
		});

		await vi.waitFor(() => expect(wrapper.findAll('a')[0]!.attributes('href')).toBe('/a/7'));
		expect(wrapper.findAll('a')[1]!.attributes('href')).toBe('/b/');
		wrapper.unmount();
	});

	test('no request on a new item nor without relational fields in the URLs', async () => {
		mountLinks({ primaryKey: '+' }).unmount();
		mountLinks({ links: [links[1]] }).unmount();
		await flushPromises();

		expect(fetch).not.toHaveBeenCalled();
	});

	test('a fetch error shows the translated error', async () => {
		const forbidden = () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403);
		await setup({ 'GET /items/bo_groups/1': forbidden });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = mountLinks({});

		await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain(i18n.global.t('errors.FORBIDDEN')));
		warn.mockRestore();
		wrapper.unmount();
	});

	test('a flow button is shown only when the flow is active', () => {
		useFlowsStore().flows[0]!.status = 'inactive';
		const wrapper = mountLinks({ links: [links[2]] });

		expect(wrapper.find('.action').exists()).toBe(false);
		wrapper.unmount();
	});

	test('a flow button runs the flow with confirmation, POST #48, `ran` emitted; disabled on a new item', async () => {
		const wrapper = mountLinks({ links: [links[2]] });

		await wrapper.get('button.action').trigger('click');
		await flushPromises();
		const dialog = document.body.querySelector('[role="dialog"]')!;
		const input = dialog.querySelector('input')!;
		input.value = 'Hi';
		input.dispatchEvent(new Event('input'));
		await flushPromises();
		[...dialog.querySelectorAll('button')].find((b) => b.textContent!.includes('Run Flow on Current Item'))!.click();

		await vi.waitFor(() => expect(wrapper.emitted('ran')).toHaveLength(1), 2000);
		const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(String(post[1]!.body))).toEqual({ note: 'Hi', collection: 'bo_groups', keys: [1] });

		await wrapper.setProps({ primaryKey: '+' });
		expect(wrapper.get('button.action').attributes('disabled')).toBe('');
		wrapper.unmount();
	});

	test('a link without label is icon-only with an aria-label', () => {
		const wrapper = mountLinks({ links: [{ type: 'normal', actionType: 'url', url: '/x' }] });
		const link = wrapper.get('.action');

		expect(link.attributes('aria-label')).toBe('Buttons');
		expect(link.text()).toBe('smart_button');
		wrapper.unmount();
	});

	test('form field ids are put on the links', () => {
		const a11y = computed(() => ({ inputId: 'f-1', labelId: 'f-1-label', describedBy: 'f-1-note', invalid: false }));
		const wrapper = mountLinks({ links: [] }, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(wrapper.attributes('id')).toBe('f-1');
		expect(wrapper.attributes('aria-describedby')).toBe('f-1-note');
		wrapper.unmount();
	});
});
