// Feature 016 (T042, D-57): system-display-template, as Directus system-display-template.vue: the chip editor
// (VFieldTemplate, D-166) on the field tree of the chosen collection (the form value of collectionField, when that
// collection exists); the notice when there is no collection.
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { computed, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import BoNotice from '../../../components/BoNotice.vue';
import FieldList from '../../../components/FieldList.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
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
			provide: {
				values,
				[FORM_FIELD_A11Y as symbol]: computed(() => ({
					inputId: 'f-input',
					labelId: 'f-label',
					describedBy: 'f-note',
					invalid: false,
				})),
			},
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

test('the value shows as field chips; the menu adds a field; the form label names the textbox (D-166)', async () => {
	const wrapper = mountTemplate(
		{ collectionField: 'collection', value: 'ID {{ title }}' },
		ref({ collection: 'articles' }),
	);
	await flushPromises();

	const textbox = wrapper.get('[role="textbox"]');
	expect(textbox.attributes()).toMatchObject({ 'aria-labelledby': 'f-label', 'aria-describedby': 'f-note' });
	expect(textbox.get('button.selected-field').attributes('data-field')).toBe('title');
	expect(textbox.text()).toBe('ID Title');

	(document.querySelector(`button[aria-label="${i18n.global.t('add_field')}"]`) as HTMLButtonElement).click();
	await flushPromises();
	wrapper.findComponent(FieldList).vm.$emit('add', ['title']);
	await flushPromises();

	expect(wrapper.emitted('input')!.at(-1)![0]).toContain('{{title}}');
});
