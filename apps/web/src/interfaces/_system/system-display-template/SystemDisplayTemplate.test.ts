// Feature 016 (T042, D-57): system-display-template, as Directus system-display-template.vue: a template input whose
// field picker lists the fields of the chosen collection (the form value of collectionField, when that collection
// exists) and appends `{{ field }}`; the notice when there is no collection.
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import BoInput from '../../../components/BoInput.vue';
import BoNotice from '../../../components/BoNotice.vue';
import FieldList from '../../../components/FieldList.vue';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import config from './index.ts';
import SystemDisplayTemplate from './SystemDisplayTemplate.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

beforeEach(() => {
	setActivePinia(createPinia());
	const collections = useCollectionsStore();
	collections.collections = [
		collections.prepareCollectionForApp({ collection: 'articles', schema: {}, meta: {} } as never),
	];
	useFieldsStore().fields = [
		{ collection: 'articles', field: 'title', name: 'Title', type: 'string', schema: {}, meta: { id: 1, sort: 1 } },
	] as never;
});

const mountTemplate = (props: Record<string, unknown>, values = ref<Record<string, unknown>>({})) =>
	mount(SystemDisplayTemplate, {
		props: { value: null, ...props },
		global: {
			plugins: [i18n, createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })],
			provide: { values },
		},
		attachTo: document.body,
	});

test('is registered with the Directus config', () => {
	expect(config).toMatchObject({ id: 'system-display-template', icon: 'arrow_drop_down_circle', system: true });
	expect(config.options).toEqual([expect.objectContaining({ field: 'collectionField' })]);
});

test('a notice when the form value is not an existing collection (option:system-display-template.collectionField)', () => {
	const wrapper = mountTemplate({ collectionField: 'collection' }, ref({ collection: 'nope' }));
	expect(wrapper.findComponent(BoNotice).text()).toContain(
		i18n.global.t('interfaces.system-display-template.select_a_collection'),
	);
});

test('typing emits the template, picking a field appends it', async () => {
	const wrapper = mountTemplate({ collectionField: 'collection', value: 'ID ' }, ref({ collection: 'articles' }));

	wrapper.findComponent(BoInput).vm.$emit('update:modelValue', '');
	expect(wrapper.emitted('input')![0]).toEqual([null]);

	(document.querySelector(`button[aria-label="${i18n.global.t('add_field')}"]`) as HTMLButtonElement).click();
	await flushPromises();
	const list = wrapper.findComponent(FieldList);
	expect(list.props('collection')).toBe('articles');
	list.vm.$emit('add', ['title']);

	expect(wrapper.emitted('input')![1]).toEqual(['ID {{ title }}']);
});
