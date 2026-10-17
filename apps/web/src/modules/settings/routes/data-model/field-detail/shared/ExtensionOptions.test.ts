// Feature 016 (T051): ExtensionOptions, as Directus extension-options.vue: the options form of an interface or a
// display from an array, `{ standard, advanced }` (advanced only with showAdvanced) or the `options` prop (function
// options are resolved by the caller), the "no options" notice, and an options component (list, map). For every
// registered interface and display with array or standard/advanced options, the form has the option keys of the
// Directus registry (fixtures/interfaces/directus-registry.json).
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import registry from '../../../../../../../fixtures/interfaces/directus-registry.json';
import BoNotice from '../../../../../../components/BoNotice.vue';
import BoForm from '../../../../../../components/form/BoForm.vue';
import { getDisplays } from '../../../../../../displays/index.ts';
import { getInterfaces } from '../../../../../../interfaces/index.ts';
import { i18n } from '../../../../../../lang/index.ts';
import { mockApi } from '../../../../../../test-utils/fetch.ts';
import { getOperation } from '../../../../../../operations/index.ts';
import ExtensionOptions from './ExtensionOptions.vue';

type Entry = { optionsKind: string; optionKeys: string[] };
const fixture = registry as unknown as { interfaces: Record<string, Entry>; displays: Record<string, Entry> };

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
	mockApi({});
});

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] });

const mountOptions = (props: Record<string, unknown>) =>
	mount(ExtensionOptions, {
		props: props as never,
		global: { plugins: [pinia, i18n, router] },
		attachTo: document.body,
	});

const keys = (wrapper: ReturnType<typeof mountOptions>) =>
	(wrapper.findComponent(BoForm).props('fields') as { field: string }[]).map((field) => field.field);

test('standard options only, advanced ones with showAdvanced', () => {
	const standardAdvanced = getInterfaces().find(
		(inter) => fixture.interfaces[inter.id]?.optionsKind === 'standard-advanced',
	)!;
	const options = standardAdvanced.options as { standard: { field: string }[]; advanced: { field: string }[] };

	expect(keys(mountOptions({ type: 'interface', extension: standardAdvanced.id }))).toEqual(
		options.standard.map((f) => f.field),
	);
	expect(keys(mountOptions({ type: 'interface', extension: standardAdvanced.id, showAdvanced: true }))).toEqual([
		...options.standard.map((f) => f.field),
		...options.advanced.map((f) => f.field),
	]);
});

test('the options prop wins; no options gives the notice; a value change is emitted', async () => {
	const wrapper = mountOptions({
		type: 'display',
		extension: 'raw',
		options: [{ field: 'x', type: 'string', meta: {} }],
	});
	expect(keys(wrapper)).toEqual(['x']);

	wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { x: 'y' });
	expect(wrapper.emitted('update:modelValue')).toEqual([[{ x: 'y' }]]);

	expect(mountOptions({ type: 'display', extension: 'raw' }).findComponent(BoNotice).text()).toContain(
		i18n.global.t('no_options_available'),
	);
});

test('an options component (list) is rendered with the value, collection and field', async () => {
	const wrapper = mountOptions({ type: 'interface', extension: 'list', modelValue: { template: '{{ a }}' } });
	// The options component is async (its own chunk): wait for it.
	await vi.waitFor(() => expect(wrapper.find('input').exists()).toBe(true), { timeout: 5000 });

	expect(wrapper.findComponent(BoForm).exists()).toBe(false);
	expect(wrapper.html()).toContain(i18n.global.t('interfaces.list.edit_fields'));
});

describe('the option keys of every registered extension (registry fixture)', () => {
	const cases = [
		...getInterfaces().map((inter) => ['interface', inter.id, fixture.interfaces[inter.id]] as const),
		...getDisplays().map((display) => ['display', display.id, fixture.displays[display.id]] as const),
	].filter(
		([, , entry]) => entry && ['array', 'standard-advanced'].includes(entry.optionsKind) && entry.optionKeys.length > 0,
	);

	test.each(cases)('%s %s', (type, id, entry) => {
		expect([...keys(mountOptions({ type, extension: id, showAdvanced: true }))].sort()).toEqual(
			[...entry!.optionKeys].sort(),
		);
	});
});

// Feature 017 (FR-042): an operation's options (array, or the result of its options function passed by the caller)
// render without the field detail store.
describe('type operation', () => {
	test('an array of options renders without creating the field detail store', () => {
		const wrapper = mountOptions({ type: 'operation', extension: 'log', options: getOperation('log')!.options });

		expect(keys(wrapper)).toEqual(['message']);
		expect(pinia.state.value['fieldDetailStore']).toBeUndefined();
	});

	test('function options come through the options prop', () => {
		const options = getOperation('json-web-token')!.options as (values: Record<string, unknown>) => unknown[];
		const wrapper = mountOptions({
			type: 'operation',
			extension: 'json-web-token',
			options: options({ operation: 'decode' }),
		});

		expect(keys(wrapper)).toEqual(['operation', 'token', 'options']);
	});
});
