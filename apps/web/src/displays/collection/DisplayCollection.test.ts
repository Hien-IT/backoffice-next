// Directus has no test for the collection display: fixture field bo_std.collection_name, the `icon` option, handler.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import DisplayCollection from './DisplayCollection.vue';
import display from './index.ts';

const field = fieldsOf('bo_std').find((f) => f.field === 'collection_name')!;
const value = itemOf('bo_std', 1)['collection_name'] as string;

beforeEach(async () => {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	mockFixtureApi(loadSnapshot());
	await useCollectionsStore().hydrate();
});

const mountDisplay = (props: Record<string, unknown>) =>
	mount(DisplayCollection, { props, global: { plugins: [i18n] } });

describe('collection display', () => {
	test('fixture field: name and icon of the collection', () => {
		const info = useCollectionsStore().getCollection(value)!;
		const wrapper = mountDisplay({ ...field.meta!.display_options, value });

		expect(wrapper.text()).toContain(info.name);
		expect(wrapper.find('.material-symbols-rounded').text()).toBe(info.icon);
	});

	test('option:collection.icon defaults to false', () => {
		const wrapper = mountDisplay({ value });

		expect(wrapper.find('.material-symbols-rounded').exists()).toBe(false);
		expect(wrapper.text()).toBe(useCollectionsStore().getCollection(value)!.name);
	});

	test('null value and unknown collection show ValueNull', () => {
		for (const v of [null, 'does_not_exist']) {
			expect(mountDisplay({ value: v }).get('.sr-only').text()).toBe('No value');
		}
	});

	test('handler returns the collection name, or the value when unknown', () => {
		expect(display.handler!(value, {}, {} as never)).toBe(useCollectionsStore().getCollection(value)!.name);
		expect(display.handler!('does_not_exist', {}, {} as never)).toBe('does_not_exist');
	});
});
