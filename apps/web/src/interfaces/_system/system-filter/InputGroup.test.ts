// Backoffice (spec 028, D-206): the field picker and the chip of a `$FIELD(b)` value in the value control of a rule.
// Fixture bo_content: id and sort are integers, title and status are strings, body is text, date_published a dateTime.
import type { Field, FieldFilter } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import InputGroup from './InputGroup.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();

beforeEach(() => {
	setActivePinia(createPinia());
	const fieldsStore = useFieldsStore();
	fieldsStore.fields = [...snapshot.fields, ...snapshot.systemFields].map(fieldsStore.parseField);
	useRelationsStore().relations = snapshot.relations;
});

function setup(field: FieldFilter, props: Record<string, unknown> = { includeFieldCompare: true }) {
	const wrapper = mount(InputGroup, {
		props: { field, collection: 'bo_content', ...props },
		global: {
			plugins: [i18n, createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })],
		},
		attachTo: document.body,
	});

	const picker = () => wrapper.find('button[aria-label="Compare with a field"]');
	const chip = () => wrapper.find('button[aria-label^="Compared with"]');
	const last = () => wrapper.emitted('update:field')?.at(-1)?.[0];

	async function open(trigger: ReturnType<typeof picker>) {
		await trigger.trigger('click');
		await flushPromises();
		return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
	}

	return { wrapper, picker, chip, last, open };
}

const name = (field: string) => useFieldsStore().getField('bo_content', field)!.name;

/** The text of a button or menu item without its Material Symbols ligature. */
const label = (el: { textContent: string | null } | { text(): string }) =>
	('text' in el ? el.text() : (el.textContent ?? '')).replace(/^(edit|swap_horiz)\s*/, '').trim();

describe('the field picker', () => {
	test('shows for a comparison operator on a field of a type group, with the prop only', () => {
		expect(
			setup({ sort: { _gt: 1 } })
				.picker()
				.exists(),
		).toBe(true);
		expect(
			setup({ sort: { _eq: null } })
				.picker()
				.exists(),
		).toBe(true);
		expect(
			setup({ sort: { _gt: 1 } }, { includeFieldCompare: false })
				.picker()
				.exists(),
		).toBe(false);
		expect(
			setup({ sort: { _gt: 1 } }, {})
				.picker()
				.exists(),
		).toBe(false);
	});

	test.each([
		['another operator', { title: { _contains: 'x' } }],
		['_in', { sort: { _in: [1] } }],
		['_null', { sort: { _null: true } }],
		['a csv field', { tags: { _eq: 'a' } }],
		['a geometry field', { location: { _eq: 'x' } }],
		['a json path rule', { 'json(tags, a, number)': { _gt: 1 } }],
		['a function key', { 'year(date_published)': { _eq: 2024 } }],
	])('does not show for %s', (_name, field) => {
		expect(
			setup(field as FieldFilter)
				.picker()
				.exists(),
		).toBe(false);
	});

	test('lists the number fields except the field itself; the first item keeps the value', async () => {
		const { picker, open } = setup({ sort: { _gt: 1 } });
		const items = await open(picker());
		expect(items.map(label)).toEqual(['Enter a value', name('id')]);
	});

	test('lists string and text fields for a string field', async () => {
		const { picker, open } = setup({ title: { _eq: 'x' } });
		const items = await open(picker());
		expect(items.map(label)).toEqual(['Enter a value', name('status'), name('body')]);
	});

	test('choosing a field writes $FIELD(key); "Enter a value" writes null', async () => {
		const { picker, open, last, wrapper } = setup({ sort: { _gt: 1 } });
		const items = await open(picker());
		items[1]!.click();
		await flushPromises();
		expect(last()).toEqual({ sort: { _gt: '$FIELD(id)' } });

		await wrapper.setProps({ field: { sort: { _gt: '$FIELD(id)' } } });
		const chip = wrapper.find('button[aria-label^="Compared with"]');
		const again = await open(chip);
		again[0]!.click();
		await flushPromises();
		expect(last()).toEqual({ sort: { _gt: null } });
	});

	test('a nested rule lists the fields of the related collection', async () => {
		const { picker, open } = setup({ author: { first_name: { _eq: 'x' } } } as FieldFilter);
		const items = await open(picker());
		const texts = items.map(label);
		expect(texts).toContain(useFieldsStore().getField('directus_users', 'last_name')!.name);
		expect(texts).not.toContain(useFieldsStore().getField('directus_users', 'first_name')!.name);
	});

	test('two fields with the same display name show their key', async () => {
		const fieldsStore = useFieldsStore();
		const sort = fieldsStore.getField('bo_content', 'sort') as Field;
		fieldsStore.fields.push({ ...sort, field: 'sort_two', name: sort.name });

		const { picker, open } = setup({ id: { _eq: 1 } });
		const items = await open(picker());
		expect(items.map(label)).toEqual(['Enter a value', `${sort.name} (sort)`, `${sort.name} (sort_two)`]);
	});
});

describe('the chip of a $FIELD value', () => {
	test('shows the display name of field b, its key with rawFieldNames', () => {
		const { chip, wrapper } = setup({ sort: { _gt: '$FIELD(id)' } });
		expect(label(chip())).toBe(name('id'));
		expect(chip().attributes('aria-label')).toBe(`Compared with ${name('id')}`);
		expect(chip().attributes('aria-invalid')).toBeUndefined();
		expect(wrapper.find('input').exists()).toBe(false);

		const raw = setup({ sort: { _gt: '$FIELD(id)' } }, { includeFieldCompare: true, rawFieldNames: true });
		expect(label(raw.chip())).toBe('id');
	});

	test('a field that no longer exists shows its key in the error state', () => {
		const { chip } = setup({ sort: { _gt: '$FIELD(nope)' } });
		expect(label(chip())).toBe('nope');
		expect(chip().attributes('aria-invalid')).toBe('true');
		expect(chip().attributes('title')).toBe('Field nope not found');
		expect(
			chip()
				.classes()
				.some((c) => c.includes('error')),
		).toBe(true);
	});

	test('without the prop the value stays a plain string in the input (FR-013)', () => {
		const { chip, wrapper } = setup({ sort: { _gt: '$FIELD(id)' } }, {});
		expect(chip().exists()).toBe(false);
		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('$FIELD(id)');
	});
});
