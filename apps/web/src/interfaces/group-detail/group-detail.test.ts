// Ported from directus/app/src/interfaces/group-detail/group-detail.test.ts
// Backoffice: the edited class of VDivider is the edited dot of BoDetail (`data-edited`); the comparison indicator
// cases are not ported (no comparison UI, D-55); outlets and directives are not needed (Reka portals). The second half
// mounts the bo_groups fixture in BoForm (contracts/tests.md §5).
import { flushPromises, mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { error, global, inputs, mountForm, tree } from '../group-raw/group-test-utils.ts';
import GroupDetail from './GroupDetail.vue';
import groupDetail from './index.ts';

const registry = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('../index.ts', async () => {
	const { FAKE_INTERFACES } = await import('../../components/form/test-interfaces.ts');
	const getInterface = (id?: string | null) => (id ? (registry[id] ?? FAKE_INTERFACES[id]) : undefined);
	return { getInterface, getInterfaces: () => [], sortInterfaces: (list: unknown[]) => list };
});

Object.assign(registry, { [groupDetail.id]: groupDetail });

let wrapper: VueWrapper | null = null;

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

describe('group detail interface', () => {
	it('should render the edited class when having edits', async () => {
		wrapper = mount(GroupDetail, {
			global,
			props: {
				...props,
				values: {
					headline: 'edited content',
				},
			},
		});

		expect(wrapper.find('[data-edited]').exists()).toBe(true);
	});

	it('should not render the edited class when having no edits', async () => {
		wrapper = mount(GroupDetail, {
			global,
			props,
		});

		expect(wrapper.find('[data-edited]').exists()).toBe(false);
	});
});

const props: InstanceType<typeof GroupDetail>['$props'] = {
	field: {
		collection: 'groups',
		field: 'detail',
		type: 'alias',
		schema: null,
		meta: {
			id: 216,
			collection: 'groups',
			field: 'detail',
			special: ['alias', 'no-data', 'group'],
			interface: 'group-detail',
			options: {},
			display: null,
			display_options: null,
			readonly: false,
			hidden: false,
			sort: 3,
			width: 'full',
			translations: null,
			note: null,
			conditions: null,
			required: false,
			group: null,
			validation: null,
			validation_message: null,
			searchable: true,
		},
		name: 'Detail',
	},
	fields: ['description', 'headline'].map((field, index) => ({
		collection: 'groups',
		field,
		type: 'string',
		schema: {
			name: field,
			table: 'groups',
			data_type: 'varchar',
			default_value: null,
			max_length: 255,
			numeric_precision: null,
			numeric_scale: null,
			is_generated: false,
			generation_expression: null,
			is_nullable: true,
			is_unique: false,
			is_indexed: false,
			is_primary_key: false,
			has_auto_increment: false,
			foreign_key_column: null,
			foreign_key_table: null,
		},
		meta: {
			id: 221 + index,
			collection: 'groups',
			field,
			special: null,
			interface: 'input',
			options: null,
			display: null,
			display_options: null,
			readonly: false,
			hidden: false,
			sort: index + 1,
			width: 'full',
			translations: null,
			note: null,
			conditions: null,
			required: false,
			group: 'detail',
			validation: null,
			validation_message: null,
			searchable: true,
		},
		name: field === 'description' ? 'Description' : 'Headline',
	})),
	values: {},
	initialValues: {
		id: 1,
		description: 'content',
		headline: 'content',
	},
	primaryKey: '1',
	disabled: false,
	batchMode: false,
	batchActiveFields: [],
	loading: false,
	validationErrors: [],
	start: 'closed',
};

const header = (form: VueWrapper<any>) => form.get('[data-group-detail] > button');

describe('group-detail on the bo_groups fixture', () => {
	it('option:group-detail.start closed, option:group-detail.headerIcon, option:group-detail.headerColor; no input', () => {
		const form = mountForm(tree('detail'));
		const button = header(form);

		expect(button.attributes('aria-expanded')).toBe('false');
		expect(button.text()).toContain('Detail');
		expect(button.text()).toContain('info');
		expect(button.attributes('style')).toBe(`color: ${tree('detail')[0]!.meta!.options!['headerColor']};`);
		expect(inputs(form)).toEqual([]);
		expect(form.emitted('update:modelValue')).toBeUndefined();
	});

	it('option:group-detail.start open shows the child form; a header click closes it', async () => {
		const form = mountForm(tree('detail', { start: 'open' }));

		expect(header(form).attributes('aria-expanded')).toBe('true');
		expect(inputs(form)).toEqual(['Detail', '3']);
		expect(form.findAll('[data-group-detail] label').map((label) => label.text())).toEqual([
			'Detail Text',
			'Detail Number',
		]);

		await header(form).trigger('click');
		expect(inputs(form)).toEqual([]);
	});

	it('missing options: Directus defaults (open, no icon, theme title color)', () => {
		const form = mountForm(tree('detail', null));
		const button = header(form);

		expect(button.attributes('aria-expanded')).toBe('true');
		expect(button.attributes('style')).toBeUndefined();
		expect(button.classes()).toContain('text-gray-800');
		expect(button.text()).not.toContain('info');
	});

	it('start is applied again once loading ends (conditions may change it)', async () => {
		wrapper = mount(GroupDetail, { global, props: { ...props, start: 'open', loading: true } });
		expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');

		await wrapper.setProps({ start: 'closed', loading: false });
		expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');

		// Only the first time.
		await wrapper.setProps({ start: 'open', loading: true });
		await wrapper.setProps({ loading: false });
		expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
	});

	it('opens on a child validation error; closed, the header shows the messages', async () => {
		const form = mountForm(tree('detail'), { showValidationErrors: false });

		await form.setProps({ validationErrors: [error('detail_text')] });
		expect(header(form).attributes('aria-expanded')).toBe('true');
		expect(header(form).find('[data-error]').exists()).toBe(false);

		await header(form).trigger('click');
		expect(header(form).get('[data-error] .sr-only').text()).toBe(
			`Detail Text ${i18n.global.t('validationError.required').toLowerCase()}`,
		);
	});

	it('an edit comes back through apply; the edited dot shows when closed', async () => {
		const form = mountForm(tree('detail', { start: 'open' }));

		await form.get('input').setValue('Changed');
		await flushPromises();
		expect(form.emitted('update:modelValue')?.at(-1)).toEqual([{ detail_text: 'Changed' }]);
		expect(header(form).find('[data-edited]').exists()).toBe(false);

		await header(form).trigger('click');
		expect(header(form).find('[data-edited]').exists()).toBe(true);
	});

	it('disabled reaches the children', () => {
		const form = mountForm(tree('detail', { start: 'open' }), { disabled: true });
		expect(form.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true);
	});
});
