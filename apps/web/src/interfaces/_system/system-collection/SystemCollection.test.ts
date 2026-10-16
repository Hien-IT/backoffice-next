// Feature 016 (T042, D-57): system-collection, as Directus system-collection.vue: collections that are not folders,
// singletons only with includeSingleton, the CRUD-safe system collections with includeSystem, deselect with allowNone.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import BoSelect from '../../../components/BoSelect.vue';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import config from './index.ts';
import SystemCollection from './SystemCollection.vue';

beforeEach(() => {
	setActivePinia(createPinia());
	const store = useCollectionsStore();
	store.collections = [
		{ collection: 'articles', schema: {}, meta: { singleton: false } },
		{ collection: 'home', schema: {}, meta: { singleton: true } },
		{ collection: 'a_folder', schema: null, meta: { singleton: false } },
		{ collection: 'directus_users', schema: {}, meta: { singleton: false, system: true } },
	].map((c) => store.prepareCollectionForApp(c as never));
});

const mountSelect = (props: Record<string, unknown> = {}) =>
	mount(SystemCollection, { props: { value: null, ...props }, global: { plugins: [i18n] } });

const values = (wrapper: ReturnType<typeof mountSelect>) =>
	(wrapper.findComponent(BoSelect).props('items') as { value: string }[]).map((item) => item.value);

test('is registered with the Directus config', () => {
	expect(config).toMatchObject({
		id: 'system-collection',
		icon: 'featured_play_list',
		system: true,
		types: ['string'],
	});
	expect(config.options).toEqual([expect.objectContaining({ field: 'includeSystem' })]);
});

test('lists the tables, singletons unless excluded, system ones on request (option:system-collection.includeSystem)', () => {
	expect(values(mountSelect())).toEqual(['articles', 'home']);
	expect(values(mountSelect({ includeSingleton: false }))).toEqual(['articles']);
	expect(values(mountSelect({ includeSystem: true }))).toContain('directus_users');
});

test('emits the chosen collection, and null from the deselect row', () => {
	const wrapper = mountSelect({ value: 'articles', allowNone: true });
	const select = wrapper.findComponent(BoSelect);

	expect(select.props('showDeselect')).toBe(true);
	select.vm.$emit('update:modelValue', 'home');
	select.vm.$emit('deselect');

	expect(wrapper.emitted('input')).toEqual([['home'], [null]]);
});
