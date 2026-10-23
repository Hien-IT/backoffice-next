// Repeater (`list`, spec FR-037, FR-084, FR-094 / D-60, Edge Cases): DR has no list.test.ts; these are the
// contracts/tests.md §5 checks on the bo_std `list` fixture field and its seeded values (one is not an array).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import InterfaceList from './InterfaceList.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

const field = fieldsOf('bo_std').find((f) => f.field === 'list')!;
const options = field.meta!.options as Record<string, any>;
const seeded = (id: number) => itemOf('bo_std', id)['list'];

/** Mounts like FormFieldInterface (options spread as props) and feeds `input` back as the new value (v-model). */
function mountList(props: Record<string, unknown> = {}, provide: Record<symbol, unknown> = {}) {
	const wrapper = mount(InterfaceList, {
		props: {
			...options,
			collection: 'bo_std',
			field: 'list',
			value: null,
			...props,
			onInput: (value: unknown) => wrapper.setProps({ value: value as Record<string, unknown>[] | null }),
		},
		global: { plugins: [i18n], provide },
		attachTo: document.body,
	});

	return wrapper;
}

type Wrapper = ReturnType<typeof mountList>;

const rows = (wrapper: Wrapper) => wrapper.findAll('button.row-open').map((b) => b.text().replace(/\s+/g, ' ').trim());
const drawer = () => document.querySelector<HTMLElement>('.bo-drawer');
const dialogs = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
const buttonIn = (root: ParentNode, text: string) =>
	[...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text);
const saveButton = () => drawer()!.querySelector<HTMLButtonElement>('button[aria-label="Save"]')!;
const lastInput = (wrapper: Wrapper) => wrapper.emitted('input')!.at(-1)![0];

async function typeInto(name: string, text: string) {
	const input = drawer()!.querySelector<HTMLInputElement>(`[data-field="${name}"] input, input[name="${name}"]`)!;
	input.value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await flushPromises();
}

async function openMenu(wrapper: Wrapper, index: number) {
	const trigger = wrapper.findAll('button.row-menu')[index]!.element as HTMLElement;
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
	return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

async function select(item: HTMLElement) {
	item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
}

const menuText = (item: HTMLElement) => item.textContent!.replace(/^(delete|arrow_upward|arrow_downward)/, '').trim();

describe('config', () => {
	test('is the Directus repeater on json, options as an async component (D-56 lifted in 016)', () => {
		expect(config).toMatchObject({ id: 'list', icon: 'replay', types: ['json'], group: 'selection' });
		expect((config.options as unknown as { __asyncLoader?: unknown }).__asyncLoader).toBeTypeOf('function');
	});
});

describe('fixture values', () => {
	test('a seeded array renders the rows with the template, sorted by `sort`, without emitting', async () => {
		const wrapper = mountList({ value: seeded(1) });
		await flushPromises();

		expect(rows(wrapper)).toEqual(['Row B (1)', 'Row A (2)']);
		expect(wrapper.findAll('button.row-menu').map((b) => b.attributes('aria-label'))).toEqual(['Options for Row B (1)', 'Options for Row A (2)']);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('null shows the "No items" notice', async () => {
		const wrapper = mountList({ value: seeded(2) });
		await flushPromises();

		expect(seeded(2)).toBeNull();
		expect(wrapper.text()).toContain('No items');
		expect(wrapper.find('button.row-open').exists()).toBe(false);
	});

	test('a value that is not an array shows the warning notice, no rows, no emit and no throw', async () => {
		const wrapper = mountList({ value: seeded(3), sort: undefined });
		await flushPromises();

		expect(Array.isArray(seeded(3))).toBe(false);
		expect(wrapper.get('[role="status"]').text()).toContain('not compatible with the repeater interface');
		expect(wrapper.find('button.row-open').exists()).toBe(false);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('with `sort` set, a non-array value is turned into rows by sortBy and no notice shows (Directus, R-xx)', async () => {
		const wrapper = mountList({ value: seeded(3) });
		await flushPromises();

		expect(wrapper.find('[role="status"]').exists()).toBe(false);
		expect(wrapper.findAll('button.row-open').length).toBe(Object.keys(seeded(3) as object).length);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('adding to a value that is not an array overrides it with a console warning, as Directus', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = mountList({ value: seeded(3), sort: undefined });

		await wrapper.get('.actions button').trigger('click');

		expect(warn).toHaveBeenCalledWith(expect.stringContaining('expects an array as value'));
		expect(wrapper.emitted('input')![0]![0]).toEqual([{ title: undefined, count: undefined }]);
	});
});

describe('options', () => {
	test('defaults without options: "Create New", empty template, the add opens a drawer', async () => {
		const wrapper = mountList({ fields: undefined, template: undefined, addLabel: undefined, sort: undefined });

		expect(wrapper.get('.actions button').text()).toBe('Create New');
		await wrapper.get('.actions button').trigger('click');
		await flushPromises();

		expect(wrapper.emitted('input')![0]![0]).toEqual([{}]);
		expect(drawer()).not.toBeNull();
	});

	test('option:list.addLabel is the add button text', () => {
		expect(mountList().get('.actions button').text()).toBe('Add row');
	});

	test('option:list.template renders each row; without it the first field is used', async () => {
		const value = [{ title: 'One', count: 3 }];

		expect(rows(mountList({ value }))).toEqual(['One (3)']);
		expect(rows(mountList({ value, template: undefined }))).toEqual(['One']);
		expect(rows(mountList({ value, template: '#{{ count }}' }))).toEqual(['#3']);
	});

	test('option:list.fields builds the drawer form (names formatted, required marked)', async () => {
		const wrapper = mountList({ value: [{ title: 'One', count: 3 }] });

		await wrapper.get('button.row-open').trigger('click');
		await flushPromises();

		const form = drawer()!;
		expect(form.querySelectorAll('input')).toHaveLength(2);
		expect((form.querySelector('input') as HTMLInputElement).value).toBe('One');
		expect(form.textContent).toContain('Title');
		expect(form.textContent).toContain('Count');
	});

	test('option:list.sort sorts the rows and turns dragging and moving off', async () => {
		const sorted = mountList({ value: seeded(1) });

		expect(sorted.find('.drag-handle').exists()).toBe(false);
		expect((await openMenu(sorted, 0)).map(menuText)).toEqual(['Remove Item']);
		sorted.unmount();

		const manual = mountList({ value: seeded(1), sort: undefined });
		expect(rows(manual)).toEqual(['Row A (2)', 'Row B (1)']);
		expect(manual.findAll('.drag-handle')).toHaveLength(2);
		expect((await openMenu(manual, 0)).map(menuText)).toEqual(['Remove Item', 'Move up', 'Move down']);
	});
});

describe('editing', () => {
	test('adding two rows emits an array of objects; a required empty sub-field blocks saving', async () => {
		const wrapper = mountList({ sort: undefined });

		await wrapper.get('.actions button').trigger('click');
		await flushPromises();
		expect(lastInput(wrapper)).toEqual([{ title: undefined, count: undefined }]);
		expect(saveButton().disabled).toBe(true);

		await typeInto('title', 'First');
		expect(saveButton().disabled).toBe(false);
		saveButton().click();
		await flushPromises();
		expect(lastInput(wrapper)).toEqual([{ title: 'First', count: undefined }]);

		await wrapper.get('.actions button').trigger('click');
		await flushPromises();
		await typeInto('title', 'Second');
		await typeInto('count', '5');
		saveButton().click();
		await flushPromises();

		expect(lastInput(wrapper)).toEqual([
			{ title: 'First', count: undefined },
			{ title: 'Second', count: 5 },
		]);
		expect(rows(wrapper)).toEqual(['First (--)', 'Second (5)']);
	});

	test('cancelling a new row without edits removes it again', async () => {
		const wrapper = mountList();

		await wrapper.get('.actions button').trigger('click');
		await flushPromises();
		drawer()!.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]')!.click();
		await flushPromises();

		expect(lastInput(wrapper)).toBeNull();
		expect(drawer()).toBeNull();
	});

	test('editing a row saves it in place, sorted by `sort`', async () => {
		const wrapper = mountList({ value: seeded(1) });

		await wrapper.findAll('button.row-open')[0]!.trigger('click');
		await flushPromises();
		await typeInto('count', '9');
		saveButton().click();
		await flushPromises();

		expect(lastInput(wrapper)).toEqual([
			{ title: 'Row A', count: 2 },
			{ title: 'Row B', count: 9 },
		]);
	});

	test('unsaved changes ask before discarding (FR-084): keep editing, then discard', async () => {
		const wrapper = mountList({ value: [{ title: 'One', count: 3 }] });

		await wrapper.get('button.row-open').trigger('click');
		await flushPromises();
		await typeInto('title', 'Changed');

		drawer()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await flushPromises();
		const confirm = dialogs().find((d) => d.textContent?.includes('Unsaved Changes'))!;
		expect(confirm.textContent).toContain('Are you sure you want to leave this page?');

		buttonIn(confirm, 'Keep Editing')!.click();
		await flushPromises();
		expect(dialogs().some((d) => d.textContent?.includes('Unsaved Changes'))).toBe(false);
		expect(drawer()).not.toBeNull();

		drawer()!.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]')!.click();
		await flushPromises();
		buttonIn(dialogs().find((d) => d.textContent?.includes('Unsaved Changes'))!, 'Discard Changes')!.click();
		await flushPromises();

		expect(drawer()).toBeNull();
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('closing without changes does not ask', async () => {
		const wrapper = mountList({ value: [{ title: 'One', count: 3 }] });

		await wrapper.get('button.row-open').trigger('click');
		await flushPromises();
		drawer()!.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]')!.click();
		await flushPromises();

		expect(drawer()).toBeNull();
		expect(dialogs()).toHaveLength(0);
	});

	test('sub-field schema.default_value fills new rows and the template', async () => {
		const fields = [
			{ field: 'title', name: 'Title', type: 'string', meta: { interface: 'input' } },
			{ field: 'kind', name: 'Kind', type: 'string', schema: { default_value: 'basic' }, meta: { interface: 'input' } },
		];
		const wrapper = mountList({ fields, template: '{{ title }}/{{ kind }}', sort: undefined, value: [{ title: 'Old' }] });

		expect(rows(wrapper)).toEqual(['Old/basic']);

		await wrapper.get('.actions button').trigger('click');
		await flushPromises();
		expect(lastInput(wrapper)).toEqual([{ title: 'Old' }, { title: undefined, kind: 'basic' }]);
		expect(drawer()!.querySelectorAll<HTMLInputElement>('input')[1]!.value).toBe('basic');
	});

	test('remove asks for confirmation; removing the last row emits null', async () => {
		const wrapper = mountList({ value: seeded(1) });

		await select((await openMenu(wrapper, 0)).find((i) => menuText(i) === 'Remove Item')!);
		const confirm = dialogs().find((d) => d.textContent?.includes('delete this item'))!;
		buttonIn(confirm, 'Delete')!.click();
		await flushPromises();
		expect(lastInput(wrapper)).toEqual([{ title: 'Row A', count: 2 }]);

		await select((await openMenu(wrapper, 0)).find((i) => menuText(i) === 'Remove Item')!);
		buttonIn(dialogs().find((d) => d.textContent?.includes('delete this item'))!, 'Cancel')!.click();
		await flushPromises();
		expect(wrapper.emitted('input')).toHaveLength(1);

		await select((await openMenu(wrapper, 0)).find((i) => menuText(i) === 'Remove Item')!);
		buttonIn(dialogs().find((d) => d.textContent?.includes('delete this item'))!, 'Delete')!.click();
		await flushPromises();
		expect(lastInput(wrapper)).toBeNull();
		expect(wrapper.text()).toContain('No items');
	});

	test('keyboard: "Move down" in the row menu emits the reordered array (D-60)', async () => {
		const wrapper = mountList({ value: seeded(1), sort: undefined });

		await select((await openMenu(wrapper, 0)).find((i) => menuText(i) === 'Move down')!);

		expect(lastInput(wrapper)).toEqual([
			{ title: 'Row B', count: 1 },
			{ title: 'Row A', count: 2 },
		]);
	});

	test('limit hides the add button once reached', () => {
		expect(mountList({ value: [{ title: 'a' }], limit: 1 }).find('.actions button').exists()).toBe(false);
		expect(mountList({ value: [{ title: 'a' }], limit: 2 }).find('.actions button').exists()).toBe(true);
	});
});

describe('states', () => {
	test('disabled: add and rows disabled, no drag handle, remove disabled, save disabled', async () => {
		const wrapper = mountList({ value: seeded(1), sort: undefined, disabled: true });

		expect(wrapper.get('.actions button').attributes('disabled')).toBeDefined();
		expect(wrapper.findAll('button.row-open').every((b) => b.attributes('disabled') !== undefined)).toBe(true);
		expect(wrapper.find('.drag-handle').exists()).toBe(false);

		const items = await openMenu(wrapper, 0);
		expect(items.map(menuText)).toEqual(['Remove Item']);
		expect(items[0]!.hasAttribute('data-disabled')).toBe(true);
	});

	test('nonEditable: no add button, no row menu, rows still open the (read-only) form', async () => {
		const wrapper = mountList({ value: seeded(1), sort: undefined, nonEditable: true });

		expect(wrapper.find('.actions').exists()).toBe(false);
		expect(wrapper.find('button.row-menu').exists()).toBe(false);
		expect(wrapper.find('.drag-handle').exists()).toBe(false);

		await wrapper.get('button.row-open').trigger('click');
		await flushPromises();
		expect(drawer()).not.toBeNull();
	});

	test('the group is linked to the field label and note/error (label linking)', () => {
		const a11y = computed(() => ({ inputId: 'f-list', labelId: 'f-list-label', describedBy: 'f-list-error', invalid: true }));
		const wrapper = mountList({}, { [FORM_FIELD_A11Y as symbol]: a11y });
		const group = wrapper.get('.repeater');

		expect(group.attributes()).toMatchObject({
			role: 'group',
			'aria-labelledby': 'f-list-label',
			'aria-describedby': 'f-list-error',
		});
	});
});
