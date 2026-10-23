// group-tabs has no DR test file; these follow contracts/tests.md §5 on the bo_groups fixture (tabs > tab_one
// (group-raw), tab_two (group-tabs > tab_two_a (group-raw), tab_two_b (group-detail))).
import { type DOMWrapper, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import groupDetail from '../group-detail/index.ts';
import { error, inputs, mountForm, tree } from '../group-raw/group-test-utils.ts';
import groupRaw from '../group-raw/index.ts';
import groupTabs from './index.ts';

const registry = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('../index.ts', async () => {
	const { FAKE_INTERFACES } = await import('../../components/form/test-interfaces.ts');
	const getInterface = (id?: string | null) => (id ? (registry[id] ?? FAKE_INTERFACES[id]) : undefined);
	return { getInterface, getInterfaces: () => [], sortInterfaces: (list: unknown[]) => list };
});

Object.assign(registry, { [groupTabs.id]: groupTabs, [groupRaw.id]: groupRaw, [groupDetail.id]: groupDetail });

beforeEach(() => {
	setActivePinia(createPinia());
});

const outer = (form: VueWrapper<any>) => form.get('[data-group-tabs]');
const tabs = (form: VueWrapper<any>) => outer(form).findAll(':scope > [role="tablist"] > [role="tab"]');
const name = (tab: DOMWrapper<Element>) => tab.find('span:not([data-edited])').text();
const selected = (form: VueWrapper<any>) =>
	tabs(form)
		.filter((tab) => tab.attributes('aria-selected') === 'true')
		.map(name);

describe('group-tabs on the bo_groups fixture', () => {
	it('one tab per visible direct child (nested groups included), the first one active; no input on mount', () => {
		const form = mountForm(tree('tabs'));

		expect(tabs(form).map(name)).toEqual(['Tab One', 'Tab Two']);
		expect(outer(form).get('[role="tablist"]').attributes('aria-label')).toBe('Tabs');
		expect(selected(form)).toEqual(['Tab One']);
		expect(inputs(form)).toEqual(['Tab one']);
		expect(form.emitted('update:modelValue')).toBeUndefined();
	});

	it('a tab click shows its content, including nested tabs and a nested detail group', async () => {
		const form = mountForm(tree('tabs'));

		await tabs(form)[1]!.trigger('mousedown', { button: 0 });
		expect(selected(form)).toEqual(['Tab Two']);

		const nested = outer(form).get('[data-group-tabs]');
		expect(nested.findAll('[role="tab"]').map(name)).toEqual(['Tab Two A', 'Tab Two B']);
		expect(inputs(form)).toEqual(['Tab two A']);
	});

	it('option:group-tabs.fillWidth spans every form column; the nested group (false) does not', async () => {
		const form = mountForm(tree('tabs'));
		expect(outer(form).classes()).toContain('col-span-full!');

		await tabs(form)[1]!.trigger('mousedown', { button: 0 });
		expect(outer(form).get('[data-group-tabs]').classes()).not.toContain('col-span-full!');
	});

	it('missing options: fillWidth false', () => {
		expect(outer(mountForm(tree('tabs', null))).classes()).not.toContain('col-span-full!');
	});

	it('hidden children get no tab; the first visible one is the default', () => {
		const form = mountForm(tree('tabs', undefined, { tab_one: { hidden: true } }));

		expect(tabs(form).map(name)).toEqual(['Tab Two']);
		expect(selected(form)).toEqual(['Tab Two']);
	});

	it('no visible child: nothing is rendered', () => {
		const form = mountForm(tree('tabs', undefined, { tab_one: { hidden: true }, tab_two: { hidden: true } }));
		expect(form.find('[data-group-tabs]').exists()).toBe(false);
	});

	it('switches to the first tab with an error (nested fields included) and marks it', async () => {
		const form = mountForm(tree('tabs'), { showValidationErrors: false });

		await form.setProps({ validationErrors: [error('tab_two_a_text')] });
		expect(selected(form)).toEqual(['Tab Two']);
		expect(tabs(form)[1]!.get('[data-error] .sr-only').text()).toBe(
			`Tab Two a Text ${i18n.global.t('validationError.required').toLowerCase()}`,
		);
		expect(tabs(form)[0]!.find('[data-error]').exists()).toBe(false);
	});

	it('follows the form direction', () => {
		const form = mountForm(tree('tabs'), { direction: 'rtl' });
		expect(outer(form).get('[role="tablist"]').attributes('dir')).toBe('rtl');
	});

	it('an edit comes back through apply in the Directus shape and marks the tab edited; badge', async () => {
		const form = mountForm(tree('tabs'), { badge: 'Draft' });

		expect(tabs(form)[0]!.text()).toContain('Draft');
		await form.get('input').setValue('Changed');
		await flushPromises();
		expect(form.emitted('update:modelValue')?.at(-1)).toEqual([{ tab_one_text: 'Changed' }]);
		expect(tabs(form)[0]!.find('[data-edited]').exists()).toBe(true);
		expect(tabs(form)[1]!.find('[data-edited]').exists()).toBe(false);
	});

	it('disabled reaches the tab content', () => {
		const form = mountForm(tree('tabs'), { disabled: true });
		expect(form.get('input').attributes('disabled')).toBeDefined();
	});
});
