// Feature 016 (T042, D-57): system-field-tree, as DR system-field-tree.vue: the field tree of the chosen
// collection as an exclusive checkbox tree, relational groups loaded when opened (item_duplication_fields).
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import { ref } from 'vue';
import BoCheckboxTree from '../../../components/BoCheckboxTree.vue';
import BoNotice from '../../../components/BoNotice.vue';
import { i18n } from '../../../lang/index.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import config from './index.ts';
import SystemFieldTree from './SystemFieldTree.vue';

const field = (collection: string, name: string, type = 'string') => ({
	collection,
	field: name,
	name,
	type,
	schema: {},
	meta: { id: 1, sort: null, special: null },
});

beforeEach(() => {
	setActivePinia(createPinia());
	useFieldsStore().fields = [
		field('articles', 'title'),
		field('articles', 'author', 'integer'),
		field('authors', 'id', 'integer'),
		field('authors', 'name'),
	] as never;
	useRelationsStore().relations = [
		{
			collection: 'articles',
			field: 'author',
			related_collection: 'authors',
			schema: null,
			meta: { many_collection: 'articles', many_field: 'author', one_collection: 'authors', one_field: null },
		},
	] as never;
});

const mountTree = (props: Record<string, unknown>, values = ref<Record<string, unknown>>({})) =>
	mount(SystemFieldTree, {
		props: { value: null, ...props },
		global: { plugins: [i18n], provide: { values } },
		attachTo: document.body,
	});

test('is registered with the Directus config', () => {
	expect(config).toMatchObject({ id: 'system-field-tree', name: '$t:field', icon: 'box', system: true, options: [] });
});

test('notices without a collection option or without a chosen collection', () => {
	expect(mountTree({}).findComponent(BoNotice).text()).toContain(i18n.global.t('collection_field_not_setup'));
	expect(mountTree({ collectionField: 'collection' }).findComponent(BoNotice).text()).toContain(
		i18n.global.t('select_a_collection'),
	);
});

test('the tree of the collection from the form values, exclusive, with the relational children loaded on open', async () => {
	const wrapper = mountTree({ collectionField: 'collection', value: ['title'] }, ref({ collection: 'articles' }));
	const tree = wrapper.findComponent(BoCheckboxTree);

	expect(tree.props('valueCombining')).toBe('exclusive');
	const choices = tree.props('choices') as { key: string; children?: { key: string }[] }[];
	expect(choices.map((c) => c.key)).toEqual(['title', 'author']);

	tree.vm.$emit('group-toggle', { value: 'author', open: true });
	await wrapper.vm.$nextTick();
	const loaded = tree.props('choices') as { key: string; children?: { key: string }[] }[];
	expect(loaded[1]!.children!.map((c) => c.key)).toEqual(['author.id', 'author.name']);

	tree.vm.$emit('update:modelValue', ['title', 'author.name']);
	expect(wrapper.emitted('input')).toEqual([[['title', 'author.name']]]);
	wrapper.unmount();
});
