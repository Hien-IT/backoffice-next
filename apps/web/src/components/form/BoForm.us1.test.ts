// Spec FR-010 to FR-019 (US1 scenarios 2 to 7) on fake field definitions and the fake interfaces of
// test-interfaces.ts (no real interface is registered yet).
import type { Field, ValidationError } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import type CodeMirror from 'codemirror';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import BoForm from './BoForm.vue';
import { setGroupForm } from './test-interfaces.ts';

vi.mock('../../interfaces/index.ts', async () => (await import('./test-interfaces.ts')).registryMock);

const formWidth = ref(700);

vi.mock('@vueuse/core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@vueuse/core')>()),
	useElementSize: () => ({ width: formWidth, height: ref(0) }),
}));

setGroupForm(BoForm);

beforeEach(() => {
	setActivePinia(createPinia());
	formWidth.value = 700;
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

type FieldInput = {
	type?: string;
	schema?: Record<string, unknown> | null;
	meta?: Record<string, unknown>;
	name?: string;
};

function field(name: string, { type = 'string', schema = {}, meta = {}, name: label }: FieldInput = {}): Field {
	return {
		collection: 'articles',
		field: name,
		name: label ?? name.charAt(0).toUpperCase() + name.slice(1),
		type,
		schema: schema === null ? null : { default_value: null, is_nullable: true, is_primary_key: false, ...schema },
		meta: {
			id: 1,
			collection: 'articles',
			field: name,
			interface: 'input',
			options: null,
			special: null,
			hidden: false,
			readonly: false,
			required: false,
			width: 'full',
			group: null,
			sort: null,
			note: null,
			conditions: null,
			validation: null,
			validation_message: null,
			...meta,
		},
	} as unknown as Field;
}

function group(name: string, meta: Record<string, unknown> = {}) {
	return field(name, {
		type: 'alias',
		schema: null,
		meta: { special: ['alias', 'no-data', 'group'], interface: 'group-detail', ...meta },
	});
}

function mountForm(props: Record<string, unknown>) {
	return mount(BoForm, { props: { primaryKey: 1, ...props }, global: { plugins: [i18n] }, attachTo: document.body });
}

function renderedFields(wrapper: ReturnType<typeof mountForm>) {
	return wrapper.findAll('[data-field]').map((el) => el.attributes('data-field'));
}

function input(wrapper: ReturnType<typeof mountForm>, name: string) {
	return wrapper.get(`[data-field="${name}"] input`);
}

async function openMenu(wrapper: ReturnType<typeof mountForm>, name: string) {
	const trigger = wrapper.get(`[data-field="${name}"] [aria-haspopup="menu"]`).element as HTMLElement;
	trigger.focus();
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
	return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

describe('FR-010 field order and system divider', () => {
	test('sorts by group, sort and id, skips `$` fields, puts system fields first with a divider', async () => {
		const wrapper = mountForm({
			fields: [
				field('b', { meta: { sort: 2 } }),
				field('a', { meta: { sort: 1 } }),
				field('$thumbnail'),
				field('sys', { meta: { system: true, sort: 9 } }),
			],
		});

		expect(renderedFields(wrapper)).toEqual(['sys', 'a', 'b']);
		expect(wrapper.get('[role="separator"]').isVisible()).toBe(true);

		await wrapper.setProps({
			fields: [field('a', { meta: { sort: 1 } }), field('sys', { meta: { system: true, hidden: true } })],
		});

		expect(wrapper.get('[role="separator"]').isVisible()).toBe(false);
	});
});

describe('FR-011 widths', () => {
	test('a half after a half goes to the second column; fill spans every column', () => {
		const wrapper = mountForm({
			fields: [
				field('a', { meta: { width: 'half', sort: 1 } }),
				field('b', { meta: { width: 'half', sort: 2 } }),
				field('c', { meta: { width: 'fill', sort: 3 } }),
				field('d', { meta: { width: 'half-right', sort: 4 } }),
			],
		});

		expect(wrapper.get('[data-field="a"]').classes()).toContain('@min-[31.25rem]:col-start-1');
		expect(wrapper.get('[data-field="b"]').classes()).toContain('@min-[31.25rem]:col-start-2');
		expect(wrapper.get('[data-field="c"]').classes()).toContain('col-span-full');
		expect(wrapper.get('[data-field="d"]').classes()).toContain('@min-[31.25rem]:col-start-2');
	});

	test('card (D-150): a card per visible divider with its title as header; the empty form info has no card of its own', () => {
		const divider = (name: string, sort: number, meta: Record<string, unknown> = {}) =>
			field(name, {
				type: 'alias',
				schema: null,
				meta: { interface: 'presentation-divider', special: ['alias', 'no-data'], sort, ...meta },
			});

		const plain = mountForm({ fields: [field('a', { meta: { hidden: true } })] });
		const empty = mountForm({ card: true, fields: [field('a', { meta: { hidden: true } })] });
		const card = mountForm({
			card: true,
			fields: [
				field('a', { meta: { sort: 1 } }),
				divider('prefs', 2, { options: { title: 'Preferences', icon: 'face' } }),
				field('b', { meta: { sort: 3 } }),
				divider('hidden_divider', 4, { hidden: true, options: { title: 'Hidden' } }),
				field('c', { meta: { sort: 5 } }),
				divider('nothing', 6, { options: { title: 'Nothing' } }),
				field('d', { meta: { hidden: true, sort: 7 } }),
			],
		});

		expect(plain.classes()).toContain('grid-cols-2');
		expect(plain.get('.col-span-full').classes()).toEqual(
			expect.arrayContaining(['rounded-2xl', 'border', 'bg-white']),
		);

		expect(empty.findAll(':scope > .rounded-2xl')).toHaveLength(1);
		expect(empty.text()).toContain('Empty Form');
		expect(empty.get('.col-span-full').classes()).not.toContain('border');

		const cards = card.findAll(':scope > .rounded-2xl');
		expect(cards.map((c) => c.findAll('[data-field]').map((f) => f.attributes('data-field')))).toEqual([
			['a'],
			['b', 'c'],
		]);
		expect(cards[0]!.find('h3').exists()).toBe(false);
		expect(cards[1]!.get('h3').text()).toBe('Preferences');
		expect(cards[1]!.get('.grid').classes()).toEqual(expect.arrayContaining(['border-t', 'sm:p-6']));
		expect(card.text()).not.toContain('Hidden');
		expect(card.text()).not.toContain('Nothing');
	});

	test('the grid gets the fill column when the form is wider than 726px', async () => {
		const wrapper = mountForm({ fields: [field('a')] });

		expect(wrapper.classes()).toContain('grid-cols-2');

		formWidth.value = 800;
		await nextTick();
		expect(wrapper.classes()).toContain('grid-cols-[minmax(0,21.375rem)_minmax(0,21.375rem)_1fr]');
	});
});

describe('FR-012 hidden, read-only, required, primary key', () => {
	test('hidden fields are not rendered; read-only, generated, disabled and loading lock the field', async () => {
		const wrapper = mountForm({
			fields: [
				field('hidden', { meta: { hidden: true } }),
				field('readonly', { meta: { readonly: true } }),
				field('generated', { schema: { is_generated: true } }),
				field('free'),
			],
		});

		expect(renderedFields(wrapper)).toEqual(['readonly', 'generated', 'free']);
		expect(input(wrapper, 'readonly').attributes('disabled')).toBeDefined();
		expect(input(wrapper, 'generated').attributes('disabled')).toBeDefined();
		expect(input(wrapper, 'free').attributes('disabled')).toBeUndefined();

		await wrapper.setProps({ disabled: true });
		expect(input(wrapper, 'free').attributes('disabled')).toBeDefined();

		await wrapper.setProps({ disabled: false, loading: true });
		expect(input(wrapper, 'free').attributes('disabled')).toBeDefined();
		expect(wrapper.attributes('aria-busy')).toBe('true');
		expect(wrapper.find('[data-field="free"] [data-skeleton]').exists()).toBe(true);
	});

	test('no skeleton for interfaces with hideLoader', () => {
		const wrapper = mountForm({ fields: [field('a', { meta: { interface: 'no-loader' } })], loading: true });

		expect(wrapper.find('[data-skeleton]').exists()).toBe(false);
	});

	test('required fields have a hidden star and a screen reader text', () => {
		const wrapper = mountForm({ fields: [field('title', { meta: { required: true } })] });
		const label = wrapper.get('[data-field="title"]');

		expect(label.get('[aria-hidden="true"].text-error-600').text()).toBe('*');
		expect(label.text()).toContain('Required');
	});

	test('an auto-increment or uuid primary key is read-only except on a new item', async () => {
		const fields = [
			field('id', { type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }),
			field('uuid', { schema: { is_primary_key: true }, meta: { special: ['uuid'] } }),
		];

		const wrapper = mountForm({ fields, primaryKey: 5 });
		expect(input(wrapper, 'id').attributes('disabled')).toBeDefined();
		expect(input(wrapper, 'uuid').attributes('disabled')).toBeDefined();

		await wrapper.setProps({ primaryKey: '+' });
		expect(input(wrapper, 'id').attributes('disabled')).toBeUndefined();
		expect(input(wrapper, 'uuid').attributes('disabled')).toBeUndefined();
	});
});

describe('FR-013 conditions', () => {
	const conditional = (conditions: Record<string, unknown>[], options: Record<string, unknown> | null = null) =>
		field('target', { meta: { conditions, options, sort: 2 } });

	test('the last matching rule wins and follows edits, defaults included', async () => {
		const status = field('status', { schema: { default_value: 'draft' }, meta: { sort: 1 } });

		const wrapper = mountForm({
			fields: [
				status,
				conditional([
					{ name: 'hide drafts', rule: { status: { _eq: 'draft' } }, hidden: true },
					{ name: 'lock archived', rule: { status: { _eq: 'archived' } }, readonly: true },
				]),
			],
			primaryKey: '+',
		});

		expect(renderedFields(wrapper)).toEqual(['status']);

		await wrapper.setProps({ modelValue: { status: 'archived' } });
		expect(input(wrapper, 'target').attributes('disabled')).toBeDefined();

		await wrapper.setProps({ modelValue: { status: 'published' } });
		expect(input(wrapper, 'target').attributes('disabled')).toBeUndefined();
	});

	test('condition options replace option arrays; $version is null', () => {
		const wrapper = mountForm({
			fields: [
				conditional(
					[{ name: 'no version', rule: { $version: { _null: true } }, options: { choices: ['x'] }, required: true }],
					{ choices: ['a', 'b'], placeholder: 'kept' },
				),
			],
		});

		const fake = wrapper.getComponent({ name: 'FakeInput' });
		expect(fake.props('choices')).toEqual(['x']);
		expect(fake.props('placeholder')).toBe('kept');
		expect(wrapper.get('[data-field="target"]').text()).toContain('*');
	});
});

describe('FR-014 groups', () => {
	test('a group renders its interface with the child form; read-only and required are pushed down', () => {
		const wrapper = mountForm({
			fields: [
				group('details', { readonly: true, required: true, sort: 1 }),
				field('child', { meta: { group: 'details' } }),
				field('outside', { meta: { sort: 2 } }),
			],
		});

		const section = wrapper.get('[data-group="details"]');
		expect(section.find('[data-field="child"]').exists()).toBe(true);
		expect(section.get('[data-field="child"] input').attributes('disabled')).toBeDefined();
		expect(section.get('[data-field="child"]').text()).toContain('*');
		expect(renderedFields(wrapper)).toEqual(['child', 'outside']);
	});

	test('a group with a null or unknown interface is skipped with its children, without a warning', () => {
		const warn = vi.spyOn(console, 'warn');

		for (const groupInterface of [null, 'not-registered']) {
			const wrapper = mountForm({
				fields: [
					group('details', { interface: groupInterface, sort: 1 }),
					field('child', { meta: { group: 'details' } }),
					field('outside', { meta: { sort: 2 } }),
				],
			});

			expect(wrapper.find('[data-group]').exists()).toBe(false);
			expect(renderedFields(wrapper)).toEqual(['outside']);
		}

		expect(warn).not.toHaveBeenCalled();
	});

	test('edits in a group come back through apply', async () => {
		const wrapper = mountForm({
			fields: [group('details'), field('child', { meta: { group: 'details' } })],
			initialValues: { child: 'old' },
		});

		await input(wrapper, 'child').setValue('new');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ child: 'new' }]);
	});
});

describe('FR-015 values', () => {
	test('emits only the edits; an edit back to the initial value is dropped; hasEdits follows', async () => {
		const wrapper = mountForm({ fields: [field('title'), field('body')], initialValues: { title: 'A', body: 'B' } });
		const vm = wrapper.vm as unknown as { hasEdits: boolean };

		expect(
			input(wrapper, 'title').element.getAttribute('value') ??
				(input(wrapper, 'title').element as HTMLInputElement).value,
		).toBe('A');
		expect(vm.hasEdits).toBe(false);

		await input(wrapper, 'title').setValue('changed');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ title: 'changed' }]);

		await wrapper.setProps({ modelValue: { title: 'changed' } });
		expect(vm.hasEdits).toBe(true);

		await input(wrapper, 'title').setValue('A');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{}]);
	});

	test('on a new item the default value is shown and typing it back drops the edit', async () => {
		const wrapper = mountForm({
			fields: [field('status', { schema: { default_value: 'draft' } })],
			primaryKey: '+',
			modelValue: { status: 'x' },
		});

		expect((input(wrapper, 'status').element as HTMLInputElement).value).toBe('x');
		await input(wrapper, 'status').setValue('draft');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{}]);
	});

	test('provides the merged values to interfaces', () => {
		const wrapper = mountForm({
			fields: [field('probe', { meta: { interface: 'values-probe' } }), field('title')],
			initialValues: { title: 'A', probe: null },
			modelValue: { title: 'B' },
		});

		expect(JSON.parse(wrapper.get('[data-values]').attributes('data-values')!)).toEqual({ title: 'B', probe: null });
	});
});

describe('FR-016 label and note', () => {
	test('label linked to the control, edited dot, note as sanitized markdown opening links in a new tab', async () => {
		const wrapper = mountForm({
			fields: [field('title', { meta: { note: 'See [docs](/docs) <img src=x onerror=alert(1)>' } })],
			initialValues: { title: 'A' },
		});

		const label = wrapper.get('[data-field="title"] label');
		const control = input(wrapper, 'title');
		expect(label.attributes('for')).toBe(control.attributes('id'));

		const note = wrapper.get('[data-field="title"] small');
		expect(control.attributes('aria-describedby')).toBe(note.attributes('id'));
		expect(note.get('a').attributes()).toMatchObject({ href: '/docs', target: '_blank' });
		expect(note.html()).not.toContain('onerror');

		expect(wrapper.find('[data-edited]').exists()).toBe(false);
		await wrapper.setProps({ modelValue: { title: 'B' } });
		expect(wrapper.get('[data-edited]').text()).toBe('Value Edited');
	});

	test('interfaces with hideLabel have no label; a spacer keeps the row except for full and fill', () => {
		const wrapper = mountForm({
			fields: [
				field('half', { meta: { interface: 'hide-label', width: 'half', sort: 1 } }),
				field('full', { meta: { interface: 'hide-label', width: 'full', sort: 2 } }),
			],
		});

		// Backoffice (T093): only the sr-only label that keeps the control named.
		expect(wrapper.findAll('label').every((label) => label.classes('sr-only'))).toBe(true);
		expect(wrapper.find('[data-field="half"] > .h-6').exists()).toBe(true);
		expect(wrapper.find('[data-field="full"] > .h-6').exists()).toBe(false);
	});
});

describe('FR-017 field menu and raw editor', () => {
	test('editable field: edit raw, reset to default, undo and clear, with their Directus disable rules', async () => {
		const wrapper = mountForm({
			fields: [field('title', { schema: { default_value: 'def' } })],
			initialValues: { title: 'A' },
			modelValue: { title: 'B' },
		});

		const items = await openMenu(wrapper, 'title');
		const texts = items.map((item) => item.textContent);

		for (const option of ['Edit Raw Value', 'Reset to Default', 'Undo Changes', 'Clear Value']) {
			expect(texts.some((text) => text?.includes(option))).toBe(true);
		}

		expect(texts.some((text) => text?.includes('View Raw Value'))).toBe(false);

		items.find((item) => item.textContent?.includes('Clear Value'))!.click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ title: null }]);
	});

	test('read-only field: view raw value only, no change options', async () => {
		const wrapper = mountForm({
			fields: [field('title', { meta: { readonly: true }, schema: { default_value: 'def' } })],
			initialValues: { title: 'A' },
		});

		const texts = (await openMenu(wrapper, 'title')).map((item) => item.textContent);

		expect(texts.some((text) => text?.includes('View Raw Value'))).toBe(true);

		for (const option of ['Edit Raw Value', 'Paste Raw Value', 'Reset to Default', 'Undo Changes', 'Clear Value']) {
			expect(texts.some((text) => text?.includes(option))).toBe(false);
		}
	});

	test('the raw editor dialog casts the value back to the field type', async () => {
		const wrapper = mountForm({ fields: [field('count', { type: 'integer' })], initialValues: { count: 1 } });

		(await openMenu(wrapper, 'count')).find((item) => item.textContent?.includes('Edit Raw Value'))!.click();
		await flushPromises();

		const dialog = document.body.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain('Edit Raw Value');

		const editor = (dialog.querySelector('.CodeMirror') as unknown as { CodeMirror: CodeMirror.Editor }).CodeMirror;
		editor.replaceRange('42', { line: 0, ch: 0 }, { line: 0, ch: 1 }, '+input');

		[...dialog.querySelectorAll('button')].find((button) => button.textContent?.includes('Done'))!.click();
		await flushPromises();

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ count: 42 }]);
	});

	test('the raw editor toggle swaps the interface for system-raw-editor', async () => {
		const wrapper = mountForm({ fields: [field('title')], initialValues: { title: 'A' }, rawEditorEnabled: true });
		const toggle = wrapper.get('[data-field="title"] button[aria-pressed]');

		expect(toggle.attributes('aria-pressed')).toBe('false');
		await toggle.trigger('click');

		expect(wrapper.find('[data-field="title"] .system-raw-editor').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'FakeInput' }).exists()).toBe(false);
		expect(wrapper.get('[data-field="title"] button[aria-pressed]').attributes('aria-pressed')).toBe('true');
	});
});

describe('FR-018 validation errors', () => {
	const error = (fieldKey: string, extra: Record<string, unknown> = {}) =>
		({ collection: 'articles', field: fieldKey, type: 'nnull', path: [], ...extra }) as unknown as ValidationError;

	test('lists "name: message", scrolls to and focuses the field; the field shows its message', async () => {
		const wrapper = mountForm({
			fields: [field('title', { meta: { required: true } }), field('body')],
			validationErrors: [error('title')],
		});

		const notice = wrapper.get('[role="alert"]');
		expect(notice.text()).toContain('The following fields have invalid values:');
		expect(notice.text()).toContain('Title: Value is required');

		await notice.get('button').trigger('click');
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
		expect(document.activeElement).toBe(input(wrapper, 'title').element);

		expect(input(wrapper, 'title').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('[data-field="title"]').text()).toContain("Value can't be null");
	});

	test('hidden and hidden-in-group variants, RECORD_NOT_UNIQUE, custom validation message', () => {
		const wrapper = mountForm({
			fields: [
				group('details', { sort: 1 }),
				field('secret', { meta: { hidden: true, group: 'details' } }),
				field('hidden', { meta: { hidden: true, sort: 2 } }),
				field('slug', { meta: { sort: 3 } }),
				field('code', { meta: { sort: 4, validation_message: 'Use the product code' } }),
			],
			validationErrors: [
				error('secret'),
				error('hidden'),
				error('slug', { code: 'RECORD_NOT_UNIQUE', type: 'unique' }),
				error('code', { code: 'FAILED_VALIDATION', type: 'regex' }),
			],
		});

		const notice = wrapper.get('[role="alert"]').text();
		expect(notice).toContain('Secret (Hidden in Details):');
		expect(notice).toContain('Hidden (Hidden):');
		expect(notice).toContain('Use the product code');

		expect(wrapper.get('[data-field="slug"]').text()).toContain('Value has to be unique');

		const code = wrapper.get('[data-field="code"]');
		expect(code.text()).toContain('Use the product code');
		expect(code.get('small button[aria-label]').attributes('aria-label')).toBe("Value doesn't have the correct format");
	});

	test('showValidationErrors false hides the notice', () => {
		const wrapper = mountForm({
			fields: [field('title')],
			validationErrors: [error('title')],
			showValidationErrors: false,
		});

		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
	});
});

describe('FR-019 autofocus, direction, batch mode, empty form, errors per field', () => {
	test('autofocus goes to the first visible editable field; direction reaches the interface', () => {
		const wrapper = mountForm({
			fields: [
				field('locked', { meta: { readonly: true, sort: 1 } }),
				field('a', { meta: { sort: 2 } }),
				field('b', { meta: { sort: 3 } }),
			],
			autofocus: true,
			direction: 'rtl',
		});

		expect(input(wrapper, 'a').attributes('data-autofocus')).toBe('true');
		expect(input(wrapper, 'b').attributes('data-autofocus')).toBeUndefined();
		expect(wrapper.getComponent({ name: 'FakeInput' }).props('direction')).toBe('rtl');
	});

	test('batch mode: every field like Directus useBatch, the label checkbox turns the field on with its default', async () => {
		const wrapper = mountForm({
			fields: [
				field('id', { type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } }),
				field('status', { schema: { default_value: 'draft' } }),
			],
			batchMode: true,
			primaryKey: '+',
		});

		expect(renderedFields(wrapper)).toEqual(['id', 'status']);
		expect(input(wrapper, 'status').attributes('disabled')).toBeDefined();

		const checkbox = wrapper.get('[data-field="status"] button[role="checkbox"]');
		expect(checkbox.attributes('aria-labelledby')).toBe(wrapper.get('[data-field="status"] label').attributes('id'));

		await checkbox.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ status: 'draft' }]);

		await wrapper.setProps({ modelValue: { status: 'draft' } });
		expect(input(wrapper, 'status').attributes('disabled')).toBeUndefined();

		await wrapper.get('[data-field="status"] button[role="checkbox"]').trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{}]);
	});

	test('no_visible_fields when every field is hidden, not while loading or when turned off', async () => {
		const fields = [field('a', { meta: { hidden: true } })];
		const wrapper = mountForm({ fields });

		expect(wrapper.text()).toContain('Empty Form');
		expect(wrapper.text()).toContain('This form has no visible fields.');

		await wrapper.setProps({ loading: true });
		expect(wrapper.text()).not.toContain('Empty Form');

		await wrapper.setProps({ loading: false, showNoVisibleFields: false });
		expect(wrapper.text()).not.toContain('Empty Form');
	});

	test('an interface that throws shows unexpected_error, the other fields keep working', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const wrapper = mountForm({
			fields: [field('broken', { meta: { interface: 'broken', sort: 1 } }), field('ok', { meta: { sort: 2 } })],
		});

		await nextTick();
		expect(wrapper.get('[data-field="broken"]').text()).toContain('Unexpected Error');

		await input(wrapper, 'ok').setValue('works');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ ok: 'works' }]);
	});

	test('the default interface replaces a null or unknown one; a missing default shows interface_not_found', () => {
		const wrapper = mountForm({
			fields: [
				field('unknown', { meta: { interface: 'not-registered', sort: 1 } }),
				field('flag', { type: 'boolean', meta: { interface: null, sort: 2 } }),
			],
		});

		expect(wrapper.find('[data-field="unknown"] input').exists()).toBe(true);
		expect(wrapper.get('[data-field="flag"]').text()).toContain('Interface "boolean" not found.');
	});
});
