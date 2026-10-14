// T044 (contracts/tests.md §4): BoForm on collection bo_std of the fixture snapshot, fields store hydrated through
// mockFixtureApi, the real registered interfaces and the seeded item: US1 scenarios 1-7 and a new item (FR-015).
import type { ValidationError } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import BoForm from './BoForm.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
const item = snapshot.items['bo_std']!.find((row) => row['id'] === 1)!;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	setActivePinia(createPinia());
	Element.prototype.scrollIntoView = vi.fn();
	fetch = mockFixtureApi(snapshot);
	await useFieldsStore().hydrate();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** Mounts the bo_std form like the item screen: v-model on the edits, the seeded item as initial values. */
async function mountForm(props: Record<string, unknown> = {}) {
	const wrapper = mount(BoForm, {
		props: {
			collection: 'bo_std',
			primaryKey: 1,
			initialValues: item,
			modelValue: {},
			'onUpdate:modelValue': (edits: Record<string, unknown>) => wrapper.setProps({ modelValue: edits }),
			...props,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>;

const fieldEl = (wrapper: Wrapper, name: string) => wrapper.get(`[data-field="${name}"]`);
const control = (wrapper: Wrapper, name: string) =>
	fieldEl(wrapper, name).get<HTMLInputElement>('[data-interface] input, [data-interface] textarea');
const lastEdits = (wrapper: Wrapper) => wrapper.emitted<[Record<string, unknown>]>('update:modelValue')?.at(-1)?.[0];

describe('bo_std form from the fixture snapshot', () => {
	test('no edit is emitted on mount for any field; every field is rendered or hidden as configured', async () => {
		const wrapper = await mountForm();
		await vi.waitFor(() => expect(wrapper.find('[data-field="code_json"] .CodeMirror').exists()).toBe(true));
		await flushPromises();

		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(wrapper.find('[data-field="id"]').exists()).toBe(false);
		expect(wrapper.find('[data-field="input_hidden"]').exists()).toBe(false);
		expect(control(wrapper, 'input_readonly').attributes('disabled')).toBeDefined();
		expect(control(wrapper, 'input_string').element.value).toBe('alpha');
	});

	test('US1-1: input options placeholder, iconLeft, font, softLength counter and trim on blur', async () => {
		const wrapper = await mountForm({ initialValues: { ...item, input_string: null } });
		const field = fieldEl(wrapper, 'input_string');
		const input = control(wrapper, 'input_string');

		expect(input.attributes('placeholder')).toBe('Type here');
		expect(field.get('[data-icon-left]').text()).toBe('title');
		expect(field.get('[data-input-frame]').classes()).toContain('font-[family-name:ui-serif,Georgia,serif]');
		expect(fieldEl(wrapper, 'input_float').get('[data-input-frame]').classes()).toContain(
			'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
		);
		// softLength 50: the counter shows the remaining characters
		expect(field.get('[data-remaining]').text()).toBe('50');

		await input.setValue('  Beta  ');
		expect(lastEdits(wrapper)).toEqual({ input_string: '  Beta  ' });
		expect(field.get('[data-remaining]').text()).toBe('42');

		await input.trigger('blur');
		expect(lastEdits(wrapper)).toEqual({ input_string: 'Beta' });
	});

	test('US1-2: a null or unregistered interface uses the default interface of the type (FR-002, FR-003)', async () => {
		const wrapper = await mountForm();

		// string → input, text → input-multiline (get-default-interface-for-type.ts)
		expect(fieldEl(wrapper, 'interface_null').find('[data-interface] input').exists()).toBe(true);
		expect(fieldEl(wrapper, 'interface_unknown').find('[data-interface] textarea').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Interface "bo-extension-interface" not found.');

		await control(wrapper, 'interface_unknown').setValue('typed');
		expect(lastEdits(wrapper)).toEqual({ interface_unknown: 'typed' });
	});

	test('US1-3: when two conditions match, the last one alone applies and follows edits', async () => {
		const wrapper = await mountForm();
		const conditional = () => fieldEl(wrapper, 'input_conditional');

		// boolean = true matches both rules: the last one (placeholder, not required) wins, not a merge of the two.
		expect(control(wrapper, 'input_conditional').attributes('placeholder')).toBe('Conditional placeholder');
		expect(conditional().text()).not.toContain('*');

		await fieldEl(wrapper, 'boolean').get('[data-interface] button').trigger('click');
		expect(lastEdits(wrapper)).toEqual({ boolean: false });
		expect(control(wrapper, 'input_conditional').attributes('placeholder')).toBe('Conditional placeholder');

		await wrapper.setProps({ modelValue: { boolean: null } });
		expect(control(wrapper, 'input_conditional').attributes('placeholder')).toBe('Default placeholder');
	});

	test('US1-4: a half after a visible half goes right; full and fill take the row', async () => {
		const wrapper = await mountForm();

		expect(fieldEl(wrapper, 'input_string').classes()).toContain('col-start-1');
		expect(fieldEl(wrapper, 'input_masked').classes()).toContain('col-start-2');
		expect(fieldEl(wrapper, 'input_slug').classes()).toContain('col-start-1');
		expect(fieldEl(wrapper, 'input_text').classes()).toContain('col-span-full');
		expect(fieldEl(wrapper, 'input_multiline').classes()).toEqual(
			expect.arrayContaining(['col-start-1', 'col-span-2']),
		);
	});

	test('US1-5: an edit set back to the initial value leaves no edit', async () => {
		const wrapper = await mountForm();
		const input = control(wrapper, 'input_default');

		await input.setValue('changed');
		expect(lastEdits(wrapper)).toEqual({ input_default: 'changed' });
		expect(fieldEl(wrapper, 'input_default').find('[data-edited]').exists()).toBe(true);

		await input.setValue('plain');
		expect(lastEdits(wrapper)).toEqual({});
		expect(fieldEl(wrapper, 'input_default').find('[data-edited]').exists()).toBe(false);
		expect((wrapper.vm as unknown as { hasEdits: boolean }).hasEdits).toBe(false);
	});

	test('US1-6: FAILED_VALIDATION on two fields shows the notice, scrolls to the field and the field messages', async () => {
		const errors = [
			{ collection: 'bo_std', field: 'input_required', type: 'regex', code: 'FAILED_VALIDATION', path: [] },
			{ collection: 'bo_std', field: 'input_integer', type: 'lte', valid: 100, code: 'FAILED_VALIDATION', path: [] },
		] as unknown as ValidationError[];

		const wrapper = await mountForm({ validationErrors: errors });
		const notice = wrapper.get('[role="alert"]');

		expect(notice.text()).toContain('The following fields have invalid values:');
		expect(notice.text()).toContain('Must start with an uppercase letter');
		expect(notice.text()).toContain('Value has to be less than or equal to 100');

		const link = notice.findAll('button').find((b) => b.text().includes('Input Integer'))!;
		await link.trigger('click');
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
		expect(document.activeElement).toBe(control(wrapper, 'input_integer').element);

		// validation_message replaces the message, the original one is in the tooltip button
		const required = fieldEl(wrapper, 'input_required');
		expect(required.text()).toContain('Must start with an uppercase letter');
		expect(required.get('small button[aria-label]').attributes('aria-label')).toBe(
			"Value doesn't have the correct format",
		);
		expect(control(wrapper, 'input_required').attributes('aria-invalid')).toBe('true');
		expect(fieldEl(wrapper, 'input_integer').text()).toContain('Value has to be less than or equal to 100');
	});

	test('US1-7: field menu of a required field: items and disabled state of form-field-menu.vue', async () => {
		vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(), readText: vi.fn() } });
		const wrapper = await mountForm();
		const trigger = fieldEl(wrapper, 'input_required').get<HTMLElement>('[aria-haspopup="menu"]').element;

		expect(fieldEl(wrapper, 'input_required').text()).toContain('*');

		trigger.focus();
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flushPromises();

		const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((el) => [
			el.textContent!.replace(/^\s*\w+\s+/, '').trim(),
			el.hasAttribute('data-disabled'),
		]);

		// meta.required is not schema is_nullable: clear stays; no schema default: no reset; initial value: undo shown,
		// disabled while not edited.
		expect(items).toEqual([
			['Edit Raw Value', false],
			['Copy Raw Value', false],
			['Paste Raw Value', false],
			['Undo Changes', true],
			['Clear Value', false],
		]);
	});

	test('new item (primaryKey "+"): defaults applied, primary key editable, no edit on mount', async () => {
		// bo_std.id is hidden and read-only by meta; shown and editable here so only the primary key rule applies.
		const id = useFieldsStore().fields.find((f) => f.collection === 'bo_std' && f.field === 'id')!;
		Object.assign(id.meta!, { hidden: false, readonly: false });

		const wrapper = await mountForm({ primaryKey: '+', initialValues: null });

		expect(control(wrapper, 'input_with_default').element.value).toBe('Draft');
		expect(control(wrapper, 'input_string').element.value).toBe('');
		// the nextval() default of a numeric primary key is not a value (get-default-values-from-fields.ts)
		expect(control(wrapper, 'id').element.value).toBe('');
		expect(control(wrapper, 'id').attributes('disabled')).toBeUndefined();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();

		await control(wrapper, 'input_with_default').setValue('Other');
		expect(lastEdits(wrapper)).toEqual({ input_with_default: 'Other' });
		await control(wrapper, 'input_with_default').setValue('Draft');
		expect(lastEdits(wrapper)).toEqual({});

		await wrapper.setProps({ primaryKey: 1 });
		expect(control(wrapper, 'id').attributes('disabled')).toBeDefined();
	});
});
