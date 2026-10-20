// Ported from directus/app/src/components/v-field-list/v-field-list.test.ts
// Backoffice: real fields/relations stores seeded with the 013 fixture snapshot instead of mocked stores and a mocked
// useFieldTree; tree, functions, search, selection and keyboard cases added (FR-041, recipe Q-7, layout-patterns §9).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import FieldList from './FieldList.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();

beforeEach(() => {
	setActivePinia(createPinia());
	const fieldsStore = useFieldsStore();
	fieldsStore.fields = [...snapshot.fields, ...snapshot.systemFields].map(fieldsStore.parseField);
	useRelationsStore().relations = snapshot.relations;
});

function setup(props: Record<string, unknown> = {}) {
	// useFakeVersionField reads the `version` query (useVersions), as in the app.
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] });
	return mount(FieldList, { props: { collection: 'bo_rel', ...props }, global: { plugins: [i18n, router] } });
}

type Wrapper = ReturnType<typeof setup>;

const items = (wrapper: Wrapper) => wrapper.findAll('[role="treeitem"]');
const label = (item: ReturnType<Wrapper['find']>) =>
	item.find('.truncate').exists() ? item.find('.truncate').text() : item.text();
const tree = (wrapper: Wrapper) => items(wrapper).map((item) => `${item.attributes('aria-level')}:${label(item)}`);
const item = (wrapper: Wrapper, text: string, level = 1) =>
	items(wrapper).find((i) => i.attributes('aria-level') === String(level) && label(i) === text)!;
const expand = (wrapper: Wrapper, text: string, level = 1) =>
	item(wrapper, text, level).find('button').trigger('click');

describe('FieldList', () => {
	test('root fields of the collection, relational fields expandable, no alias without relation', () => {
		const wrapper = setup();

		expect(tree(wrapper)).toEqual([
			'1:ID',
			'1:Title',
			'1:M2O',
			'1:M2O Default',
			'1:Owner',
			'1:O2M List',
			'1:O2M Table',
			'1:M2M List',
			'1:M2M Table',
			'1:M2A',
			'1:Files',
			'1:File',
			'1:File Image',
			'1:Collection Item',
			'1:Collection Items',
		]);
		expect(item(wrapper, 'M2O').attributes('aria-expanded')).toBe('false');
		expect(item(wrapper, 'Title').attributes('aria-expanded')).toBeUndefined();
		expect(wrapper.find('[role="tree"]').attributes('aria-label')).toBe('Fields');
	});

	test('injectVersionField adds the $version field when the collection has versioning (Directus)', async () => {
		useCollectionsStore().collections = [{ collection: 'bo_rel', meta: { versioning: true } } as any];

		expect(tree(setup()).includes('1:Version')).toBe(false);

		const wrapper = setup({ injectVersionField: true });
		expect(tree(wrapper)).toContain('1:Version');
		await item(wrapper, 'Version').trigger('click');
		expect(wrapper.emitted('add')).toEqual([[['$version']]]);
	});

	test('clicking a field emits its key', async () => {
		const wrapper = setup();
		await item(wrapper, 'Title').trigger('click');
		await item(wrapper, 'M2O').trigger('click');
		expect(wrapper.emitted('add')).toEqual([[['title']], [['m2o']]]);
	});

	test('relational fields expand lazily, without depth limit, and emit the dotted path', async () => {
		const wrapper = setup();

		await expand(wrapper, 'M2O');
		expect(item(wrapper, 'M2O').attributes('aria-expanded')).toBe('true');
		expect(tree(wrapper).filter((row) => row.startsWith('2:'))).toEqual([
			'2:ID',
			'2:Name',
			'2:Status',
			'2:Sort',
			'2:O2M List Parent',
			'2:O2M Table Parent',
		]);

		await expand(wrapper, 'O2M List Parent', 2);
		expect(item(wrapper, 'Title', 3)).toBeDefined();
		await expand(wrapper, 'M2O', 3);
		await item(wrapper, 'Name', 4).trigger('click');

		expect(wrapper.emitted('add')).toEqual([[['m2o.o2m_list_parent.m2o.name']]]);

		await expand(wrapper, 'M2O');
		expect(tree(wrapper).some((row) => row.startsWith('2:'))).toBe(false);
	});

	test('groups: children under the group, the group itself is not selectable', async () => {
		const wrapper = setup({ collection: 'bo_groups' });

		expect(tree(wrapper)).not.toContain('1:Header');
		expect(tree(wrapper)).not.toContain('1:Acc Text');

		await item(wrapper, 'Accordion').trigger('click');
		expect(wrapper.emitted('add')).toBeUndefined();
		expect(item(wrapper, 'Accordion').attributes('aria-expanded')).toBe('true');

		await item(wrapper, 'Acc Text', 2).trigger('click');
		expect(wrapper.emitted('add')).toEqual([[['acc_text']]]);
	});

	test('functions per field type with includeFunctions', async () => {
		const wrapper = setup({ collection: 'bo_std', includeFunctions: true });

		expect(item(wrapper, 'Input Masked').attributes('aria-expanded')).toBeUndefined();
		await expand(wrapper, 'Date');

		const fns = tree(wrapper).filter((row) => row.startsWith('2:'));
		expect(fns).toEqual(['2:Year (Date)', '2:Month (Date)', '2:Week (Date)', '2:Day (Date)', '2:Weekday (Date)']);

		await item(wrapper, 'Year (Date)', 2).trigger('click');
		await expand(wrapper, 'Tags');
		await item(wrapper, 'Count (Tags)', 2).trigger('click');
		expect(wrapper.emitted('add')).toEqual([[['year(date)']], [['count(tags)']]]);
	});

	test('search filters the tree and opens matching groups', async () => {
		const wrapper = setup({ collection: 'bo_std' });

		await wrapper.find('input[type="search"]').setValue('time');
		await new Promise((resolve) => setTimeout(resolve, 300));
		await nextTick();

		expect(tree(wrapper)).toEqual(['1:Time', '1:Date Time', '1:Timestamp', '1:Timestamp Relative']);

		await wrapper.find('input[type="search"]').setValue('zzz');
		await new Promise((resolve) => setTimeout(resolve, 300));
		await nextTick();
		expect(items(wrapper)).toHaveLength(0);
		expect(wrapper.find('[role="status"]').text()).toBe('No Results');

		const groups = setup({ collection: 'bo_groups' });
		await groups.find('input[type="search"]').setValue('inner');
		await new Promise((resolve) => setTimeout(resolve, 300));
		await nextTick();
		expect(tree(groups)).toEqual(['1:Accordion', '2:Acc Group', '3:Acc Inner']);
	});

	test('disabledFields are aria-disabled and do not emit', async () => {
		const wrapper = setup({ disabledFields: ['title'] });

		expect(item(wrapper, 'Title').attributes('aria-disabled')).toBe('true');
		await item(wrapper, 'Title').trigger('click');
		expect(wrapper.emitted('add')).toBeUndefined();
	});

	test('relationalFieldSelectable false: a relational row toggles instead of emitting', async () => {
		const wrapper = setup({ relationalFieldSelectable: false });

		await item(wrapper, 'M2O').trigger('click');
		expect(wrapper.emitted('add')).toBeUndefined();
		expect(item(wrapper, 'M2O').attributes('aria-expanded')).toBe('true');
	});

	test('includeRelations false: only fields of the collection, nothing to expand', () => {
		const wrapper = setup({ includeRelations: false });

		expect(tree(wrapper)).not.toContain('1:O2M List');
		expect(item(wrapper, 'M2O').attributes('aria-expanded')).toBeUndefined();
	});

	test('allowSelectAll emits every non-alias root field; field limits the list to one field', async () => {
		const wrapper = setup({ allowSelectAll: true });

		await item(wrapper, 'Select All').trigger('click');
		expect(wrapper.emitted('add')![0]![0]).toEqual([
			'id',
			'title',
			'm2o',
			'm2o_default',
			'owner',
			'file',
			'file_image',
			'collection_item',
			'collection_items',
		]);

		expect(tree(setup({ field: 'm2o' }))).toEqual(['1:M2O']);
	});

	test('fieldFilter removes fields', () => {
		expect(tree(setup({ fieldFilter: (field: { field: string }) => field.field !== 'title' }))).not.toContain(
			'1:Title',
		);
	});

	test('keyboard: roving tabindex, arrows, Home/End, Enter', async () => {
		const wrapper = setup();
		const tabbable = () => label(items(wrapper).find((i) => i.attributes('tabindex') === '0')!);

		expect(tabbable()).toBe('ID');
		await items(wrapper)[0]!.trigger('keydown', { key: 'ArrowDown' });
		await items(wrapper)[1]!.trigger('keydown', { key: 'ArrowDown' });
		expect(tabbable()).toBe('M2O');

		await item(wrapper, 'M2O').trigger('keydown', { key: 'ArrowRight' });
		expect(item(wrapper, 'M2O').attributes('aria-expanded')).toBe('true');
		await item(wrapper, 'M2O').trigger('keydown', { key: 'ArrowRight' });
		expect(tabbable()).toBe('ID');
		expect(
			items(wrapper)
				.find((i) => i.attributes('tabindex') === '0')!
				.attributes('aria-level'),
		).toBe('2');

		await item(wrapper, 'ID', 2).trigger('keydown', { key: 'Enter' });
		expect(wrapper.emitted('add')).toEqual([[['m2o.id']]]);

		await item(wrapper, 'ID', 2).trigger('keydown', { key: 'ArrowLeft' });
		expect(tabbable()).toBe('M2O');
		await item(wrapper, 'M2O').trigger('keydown', { key: 'ArrowLeft' });
		expect(item(wrapper, 'M2O').attributes('aria-expanded')).toBe('false');

		await item(wrapper, 'M2O').trigger('keydown', { key: 'End' });
		expect(tabbable()).toBe('Collection Items');
		await item(wrapper, 'Collection Items').trigger('keydown', { key: 'Home' });
		expect(tabbable()).toBe('ID');
	});
});
