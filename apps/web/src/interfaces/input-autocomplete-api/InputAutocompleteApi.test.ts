// DR has no test for input-autocomplete-api: fixture, options (contracts/tests.md §5), both kinds of URL
// (FR-023, contracts/api-calls #43) and non-array results.
import type { FieldRaw } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import BoCombobox from '../../components/BoCombobox.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { calls, json, mockApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InputAutocompleteApi from './InputAutocompleteApi.vue';

const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);

function fieldProps(name: string) {
	const field = fields.find((f) => f.field === name) as FieldRaw;
	return { ...(field.meta?.options ?? {}), value: item[name], type: field.type };
}

function mountAutocomplete(props: Record<string, unknown>) {
	return mount(InputAutocompleteApi, { props: props as any, global: { plugins: [i18n] } });
}

async function search(wrapper: ReturnType<typeof mountAutocomplete>, text: string, wait = 500) {
	await wrapper.find('input').setValue(text);
	await vi.advanceTimersByTimeAsync(wait);
	await flushPromises();
}

const targets = [
	{ id: 1, name: 'Target one' },
	{ id: 2, name: 'Target two' },
];

let fetch: ReturnType<typeof mockApi>;
// The shared request queue of sdk.ts keeps its interval end across tests: the fake clock must not go back.
let clock = Date.now();

beforeEach(() => {
	setActivePinia(createPinia());
	vi.useFakeTimers({ now: clock });
	fetch = mockApi({
		'GET /items/bo_rel_target': targets,
		'GET /search': () => json({ results: [{ label: 'External A' }, { label: 'External B' }] }),
	});
});

afterEach(async () => {
	// Lets the shared request queue start its next interval before the clock is restored.
	await vi.advanceTimersByTimeAsync(1000);
	clock = Date.now();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('input-autocomplete-api', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'input-autocomplete-api', types: ['string', 'text'] });
		expect(config.component).toBe(InputAutocompleteApi);
	});

	test('shows the seeded value and sends nothing on mount', async () => {
		const wrapper = mountAutocomplete(fieldProps('autocomplete'));
		await flushPromises();
		expect(wrapper.find('input').element.value).toBe('Target one');
		expect(wrapper.emitted('input')).toBeUndefined();
		expect(fetch).not.toHaveBeenCalled();
	});

	test('a missing url shows a warning notice', () => {
		const wrapper = mountAutocomplete({ value: null });
		expect(wrapper.find('[role="status"]').text()).toContain('One or more options are missing');
		expect(wrapper.find('input').exists()).toBe(false);
	});

	test('option:input-autocomplete-api.url "/" goes through the API with the session', async () => {
		const wrapper = mountAutocomplete(fieldProps('autocomplete'));
		await search(wrapper, 'Tar get');

		expect(calls(fetch)).toEqual(['GET /items/bo_rel_target?search=Tar get']);
		expect(fetch.mock.calls[0]![1]).toMatchObject({ credentials: 'include' });
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['Tar get']);
	});

	test('option:input-autocomplete-api.resultsPath option:input-autocomplete-api.textPath option:input-autocomplete-api.valuePath', async () => {
		const wrapper = mountAutocomplete(fieldProps('autocomplete'));
		await search(wrapper, 'T');

		expect(wrapper.findComponent(BoCombobox).props('items')).toEqual([
			{ text: 'Target one', value: 'Target one' },
			{ text: 'Target two', value: 'Target two' },
		]);

		wrapper.findComponent(BoCombobox).vm.$emit('update:modelValue', 'Target two');
		expect(wrapper.emitted('input')?.at(-1)).toEqual(['Target two']);
	});

	test('valuePath alone shows the values, no paths shows the raw results', async () => {
		const valueOnly = mountAutocomplete({ ...fieldProps('autocomplete'), textPath: undefined, valuePath: 'id' });
		await search(valueOnly, 'T');
		expect(valueOnly.findComponent(BoCombobox).props('items')).toEqual([
			{ text: '1', value: 1 },
			{ text: '2', value: 2 },
		]);

		const raw = mountAutocomplete({ url: '/items/bo_rel_target?search={{value}}', resultsPath: 'data', value: null });
		await search(raw, 'T');
		expect(
			raw
				.findComponent(BoCombobox)
				.props('items')
				.map((i: { value: unknown }) => i.value),
		).toEqual(targets);
	});

	test('option:input-autocomplete-api.url external URLs are fetched without credentials or session header', async () => {
		const wrapper = mountAutocomplete({ ...fieldProps('autocomplete_external'), valuePath: 'label' });
		await search(wrapper, 'ext');

		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, init] = fetch.mock.calls[0]!;
		expect(String(url)).toBe('https://example.com/search?q=ext');
		expect(init).toEqual({ credentials: 'omit' });
		expect(wrapper.findComponent(BoCombobox).props('items')).toEqual([
			{ text: 'External A', value: 'External A' },
			{ text: 'External B', value: 'External B' },
		]);
	});

	test('non-array results give no suggestions', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = mountAutocomplete({ ...fieldProps('autocomplete'), resultsPath: 'data.0' });
		await search(wrapper, 'T');

		expect(wrapper.findComponent(BoCombobox).props('items')).toEqual([]);
		expect(warn).toHaveBeenCalledWith('Expected results type of array, "object" received');
	});

	test('a failed request gives no suggestions', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = mountAutocomplete({ ...fieldProps('autocomplete'), url: '/items/missing?search={{value}}' });
		await search(wrapper, 'T');

		expect(wrapper.findComponent(BoCombobox).props('items')).toEqual([]);
		expect(warn).toHaveBeenCalledOnce();
	});

	test('an emptied input emits null and clears the suggestions without a request', async () => {
		const wrapper = mountAutocomplete(fieldProps('autocomplete'));
		await search(wrapper, 'T');
		await search(wrapper, '');

		expect(wrapper.emitted('input')?.at(-1)).toEqual([null]);
		expect(wrapper.findComponent(BoCombobox).props('items')).toEqual([]);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	test('option:input-autocomplete-api.trigger option:input-autocomplete-api.rate debounce waits for the pause', async () => {
		// debounce, rate 300
		const wrapper = mountAutocomplete(fieldProps('autocomplete'));
		const input = wrapper.find('input');
		await input.setValue('T');
		await vi.advanceTimersByTimeAsync(200);
		await input.setValue('Ta');
		await vi.advanceTimersByTimeAsync(200);
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(100);
		expect(calls(fetch)).toEqual(['GET /items/bo_rel_target?search=Ta']);
	});

	test('throttle (default trigger, rate 500) sends the first and the last value of a burst', async () => {
		const wrapper = mountAutocomplete({ ...fieldProps('autocomplete'), trigger: undefined, rate: undefined });
		const input = wrapper.find('input');
		await input.setValue('T');
		await input.setValue('Ta');
		await input.setValue('Tar');
		await vi.advanceTimersByTimeAsync(0);
		expect(calls(fetch)).toEqual(['GET /items/bo_rel_target?search=T']);
		await vi.advanceTimersByTimeAsync(500);
		expect(calls(fetch)).toEqual(['GET /items/bo_rel_target?search=T', 'GET /items/bo_rel_target?search=Tar']);
	});

	test('option:input-autocomplete-api.placeholder', () => {
		expect(mountAutocomplete(fieldProps('autocomplete')).find('input').attributes('placeholder')).toBe(
			'Search targets',
		);
	});

	test('option:input-autocomplete-api.iconLeft option:input-autocomplete-api.iconRight', () => {
		const wrapper = mountAutocomplete(fieldProps('autocomplete'));
		expect(wrapper.find('[data-icon-left]').text()).toBe('search');
		expect(wrapper.find('[data-icon-right]').text()).toBe('list');
		expect(wrapper.find('[data-prepend] [data-icon-left]').exists()).toBe(true);
		expect(wrapper.get('input').classes()).toContain('ps-11');
		expect(wrapper.find('[data-append] [data-icon-right]').exists()).toBe(true);
		expect(wrapper.get('input').classes()).toContain('pe-20');
	});

	test('option:input-autocomplete-api.font', () => {
		expect(mountAutocomplete(fieldProps('autocomplete')).classes()).toContain('font-outfit');
		expect(mountAutocomplete({ ...fieldProps('autocomplete'), font: 'monospace' }).classes()).toContain(
			'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
		);
	});

	test('disabled', () => {
		expect(
			mountAutocomplete({ ...fieldProps('autocomplete'), disabled: true })
				.find('input')
				.attributes('disabled'),
		).toBeDefined();
	});

	test('the input carries the form label id and the invalid state (FR-094)', () => {
		const a11y = computed(() => ({ inputId: 'f-input', labelId: 'f-label', describedBy: 'f-error', invalid: true }));
		const wrapper = mount(InputAutocompleteApi, {
			props: fieldProps('autocomplete') as any,
			global: { plugins: [i18n], provide: { [FORM_FIELD_A11Y as symbol]: a11y } },
		});
		const input = wrapper.find('input');
		expect(input.attributes('id')).toBe('f-input');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('aria-describedby')).toBe('f-error');
	});
});
