// Feature 016 (T042, D-57): system-field, as DR system-field.vue: fields of the collection given by name or by
// another form value, disabled by type / primary key / foreign key, reset when that collection changes.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import { nextTick, ref } from 'vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSelect from '../../../components/BoSelect.vue';
import { i18n } from '../../../lang/index.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import config from './index.ts';
import SystemField from './SystemField.vue';

const field = (collection: string, name: string, type: string, schema: Record<string, unknown> = {}) => ({
	collection,
	field: name,
	name,
	type,
	schema,
	meta: { id: 1, sort: null },
});

beforeEach(() => {
	setActivePinia(createPinia());
	useFieldsStore().fields = [
		field('articles', 'id', 'integer', { is_primary_key: true }),
		field('articles', 'rank', 'integer'),
		field('articles', 'author', 'integer', { foreign_key_table: 'directus_users' }),
		field('articles', 'title', 'string'),
		field('pages', 'slug', 'string'),
	] as never;
});

const mountField = (props: Record<string, unknown> = {}, values = ref<Record<string, unknown>>({})) =>
	mount(SystemField, { props: { value: null, ...props }, global: { plugins: [i18n], provide: { values } } });

test('is registered with the Directus config', () => {
	expect(config).toMatchObject({ id: 'system-field', name: '$t:field', icon: 'box', system: true, options: [] });
});

test('without a collection: the not set up notice', () => {
	expect(mountField().findComponent(BoNotice).text()).toContain(i18n.global.t('collection_field_not_setup'));
});

test('disables fields by type, primary key and foreign key, like the sort field of collections.yaml', () => {
	const wrapper = mountField({
		collectionName: 'articles',
		typeAllowList: ['integer'],
		allowPrimaryKey: false,
		allowForeignKeys: false,
	});

	expect(wrapper.findComponent(BoSelect).props('items')).toEqual([
		{ text: 'id', value: 'id', disabled: true },
		{ text: 'rank', value: 'rank', disabled: false },
		{ text: 'author', value: 'author', disabled: true },
		{ text: 'title', value: 'title', disabled: true },
	]);
});

test('reads the collection from another form value and resets when it changes', async () => {
	const values = ref<Record<string, unknown>>({ target: 'articles' });
	const wrapper = mountField({ collectionField: 'target', value: 'title', allowNone: true }, values);

	expect(wrapper.findComponent(BoSelect).props('showDeselect')).toBe(true);
	values.value = { target: 'pages' };
	await nextTick();

	expect(wrapper.emitted('input')).toEqual([[null]]);
	expect((wrapper.findComponent(BoSelect).props('items') as unknown[]).length).toBe(1);
});
