// Feature 016 T012: the field tree shared by FieldList (014), system-display-template, system-field-tree, system-fields
// and the permission field tab. Seeded with the 013 fixture snapshot like FieldList.test.ts.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp, ref } from 'vue';
import { i18n } from '../lang/index.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useFieldTree } from './use-field-tree.ts';

const snapshot = loadSnapshot();

beforeEach(() => {
	setActivePinia(createPinia());
	const fieldsStore = useFieldsStore();
	fieldsStore.fields = [...snapshot.fields, ...snapshot.systemFields].map(fieldsStore.parseField);
	useRelationsStore().relations = snapshot.relations;
});

/** useI18n needs a component instance: run the composable inside a throwaway app. */
function run<T>(fn: () => T): T {
	let result!: T;
	const app = createApp({ setup: () => ((result = fn()), () => null) });
	app.use(i18n).mount(document.createElement('div'));
	return result;
}

describe('useFieldTree', () => {
	test('root fields with relations, first level of relational children loaded', () => {
		const { treeList } = run(() => useFieldTree(ref('bo_rel')));
		const m2o = treeList.value.find((node) => node.field === 'm2o')!;

		expect(treeList.value.map((node) => node.field)).toContain('title');
		expect(m2o.relatedCollection).toBe('bo_rel_target');
		expect(m2o.key).toBe('m2o');
		expect(m2o.children?.map((child) => child.key)).toContain('m2o.id');
	});

	test('m2a: the junction item field gives one node per allowed collection, keyed item:collection', () => {
		const { treeList, loadFieldRelations } = run(() => useFieldTree(ref('bo_rel')));
		const m2a = treeList.value.find((node) => node.field === 'm2a')!;
		loadFieldRelations('m2a');
		const items = m2a.children!.filter((node) => node.field.startsWith('item:'));

		expect(items.length).toBeGreaterThan(1);
		for (const node of items) expect(node.key).toBe(`m2a.item:${node.relatedCollection}`);
	});

	test('includeRelations false (also as a ref): no related collection on any node', () => {
		const flag = ref(false);
		const { treeList } = run(() => useFieldTree(ref('bo_rel'), undefined, () => true, flag));

		expect(treeList.value.every((node) => node.relatedCollection === undefined)).toBe(true);
	});

	test('filter and refresh: a filtered field is left out', () => {
		const { treeList, refresh } = run(() => useFieldTree(ref('bo_rel'), undefined, (field) => field.field !== 'title'));
		refresh();

		expect(treeList.value.map((node) => node.field)).not.toContain('title');
	});
});
