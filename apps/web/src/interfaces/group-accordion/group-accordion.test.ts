// Ported from directus/app/src/interfaces/group-accordion/group-accordion.test.ts
// Backoffice: VItem/VItemGroup stubs are gone (BoAccordion is mounted for real, `start: 'first'` opens the section);
// the second half mounts the bo_groups fixture fields in BoForm (contracts/tests.md §5). The registry is the fake one
// of the form tests plus the real group interfaces.
import type { Field } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BoForm from '../../components/form/BoForm.vue';
import { i18n } from '../../lang/index.ts';
import { error, global, inputs, mountForm, tree } from '../group-raw/group-test-utils.ts';
import groupRaw from '../group-raw/index.ts';
import GroupAccordion from './GroupAccordion.vue';
import groupAccordion from './index.ts';

const registry = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('../index.ts', async () => {
	const { FAKE_INTERFACES } = await import('../../components/form/test-interfaces.ts');
	const getInterface = (id?: string | null) => (id ? (registry[id] ?? FAKE_INTERFACES[id]) : undefined);
	return { getInterface, getInterfaces: () => [], sortInterfaces: (list: unknown[]) => list };
});

Object.assign(registry, { [groupAccordion.id]: groupAccordion, [groupRaw.id]: groupRaw });

beforeEach(() => {
	setActivePinia(createPinia());
});

const groupFieldName = 'my_group';

// A field that belongs to the group, so AccordionSection renders
const childField: Field = {
	field: 'title',
	collection: 'articles',
	name: 'Title',
	type: 'string',
	schema: null,
	meta: { group: groupFieldName } as any,
};

const groupField: Field = {
	field: groupFieldName,
	collection: 'articles',
	name: 'My Group',
	type: 'alias',
	schema: null,
	meta: { field: groupFieldName, special: ['group'], interface: 'group-accordion' } as any,
};

const baseProps = {
	field: groupField,
	fields: [groupField, childField],
	values: {},
	initialValues: {},
	primaryKey: '1',
};

describe('group-accordion', () => {
	it('forwards version through AccordionSection to inner VForm', () => {
		const version = { id: 'abc', key: 'draft', collection: 'articles', item: '1' };

		const wrapper = mount(GroupAccordion, {
			props: { ...baseProps, start: 'first', version: version as any },
			global,
		});

		const form = wrapper.findComponent(BoForm);
		expect(form.props('version')).toEqual(version);
	});
});

const headers = (wrapper: ReturnType<typeof mountForm>) => wrapper.findAll('[data-group-accordion] h3 > button');
const name = (button: { text(): string }) => button.text().replace('expand_more', '').trim();

describe('group-accordion on the bo_groups fixture', () => {
	it('one section per direct child (nested group included), labelled header buttons; no input on mount', async () => {
		const wrapper = mountForm(tree('accordion'));
		await flushPromises();
		const buttons = headers(wrapper);

		expect(buttons.map(name)).toEqual(['Acc Text', 'Acc Group']);
		expect(buttons.every((button) => button.element.parentElement!.tagName === 'H3')).toBe(true);
		expect(buttons[0]!.attributes('aria-expanded')).toBeDefined();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('option:group-accordion.start opened shows every section (with the nested group content)', () => {
		const wrapper = mountForm(tree('accordion'));

		expect(headers(wrapper).map((button) => button.attributes('aria-expanded'))).toEqual(['true', 'true']);
		expect(inputs(wrapper)).toEqual(['Accordion text', 'Inner']);
		// The section field hides its label (the header names it); the nested group's child keeps its own.
		expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['Acc Inner']);
	});

	it('option:group-accordion.start first + option:group-accordion.accordionMode true: one section at a time', async () => {
		const wrapper = mountForm(tree('accordion_single'));
		const buttons = headers(wrapper);

		expect(buttons.map((button) => button.attributes('aria-expanded'))).toEqual(['true', 'false']);

		await buttons[1]!.trigger('click');
		expect(buttons.map((button) => button.attributes('aria-expanded'))).toEqual(['false', 'true']);
	});

	it('option:group-accordion.accordionMode false: sections open independently, Shift+click toggles all', async () => {
		const wrapper = mountForm(tree('accordion', { accordionMode: false, start: 'closed' }));
		const buttons = headers(wrapper);
		const expanded = () => buttons.map((button) => button.attributes('aria-expanded'));

		await buttons[0]!.trigger('click');
		expect(expanded()).toEqual(['true', 'false']);

		await buttons[1]!.trigger('click', { shiftKey: true });
		expect(expanded()).toEqual(['true', 'true']);

		await buttons[0]!.trigger('click', { shiftKey: true });
		expect(expanded()).toEqual(['false', 'false']);
	});

	it('missing options: Directus defaults (accordionMode true, start closed)', async () => {
		const wrapper = mountForm(tree('accordion', null));
		const buttons = headers(wrapper);

		expect(buttons.map((button) => button.attributes('aria-expanded'))).toEqual(['false', 'false']);
		await buttons[0]!.trigger('click');
		await buttons[1]!.trigger('click', { shiftKey: true });
		expect(buttons.map((button) => button.attributes('aria-expanded'))).toEqual(['false', 'true']);
	});

	it('a section with a validation error opens; a closed one shows the error icon', async () => {
		const wrapper = mountForm(tree('accordion', { accordionMode: false, start: 'closed' }), {
			showValidationErrors: false,
		});

		await wrapper.setProps({ validationErrors: [error('acc_text'), error('acc_group')] });

		const buttons = headers(wrapper);
		expect(buttons.map((button) => button.attributes('aria-expanded'))).toEqual(['true', 'false']);
		expect(buttons[0]!.find('[data-error]').exists()).toBe(false);
		expect(buttons[1]!.get('[data-error]').text()).toContain(i18n.global.t('validationError.required'));
	});

	it('an edit in a section comes back through apply in the Directus shape', async () => {
		const wrapper = mountForm(tree('accordion'));

		await wrapper.find('input').setValue('Changed');
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ acc_text: 'Changed' }]);
		expect(headers(wrapper)[0]!.find('[data-edited]').exists()).toBe(true);
		expect(headers(wrapper)[1]!.find('[data-edited]').exists()).toBe(false);
	});

	it('required star, badge and disabled reach the sections', () => {
		const wrapper = mountForm(tree('accordion', undefined, { acc_text: { required: true } }), {
			disabled: true,
			badge: 'Draft',
		});
		const first = headers(wrapper)[0]!;

		expect(first.text()).toContain('*');
		expect(first.text()).toContain(i18n.global.t('required'));
		expect(first.text()).toContain('Draft');
		expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true);
	});
});
