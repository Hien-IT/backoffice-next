import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import BoSelect from '../BoSelect.vue';
import ArchiveSidebarDetail from './ArchiveSidebarDetail.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	useSidebarStore().activeAccordionItem = 'archive';
});

async function setup(path: string, archive: string | null = null) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push(path);

	const wrapper = mount(ArchiveSidebarDetail, {
		props: { collection: 'articles', archive },
		global: { plugins: [i18n, router] },
	});

	return { wrapper, router, select: wrapper.findComponent(BoSelect) };
}

test('lists the three choices and shows not archived by default', async () => {
	const { select } = await setup('/content/articles');

	expect(select.props('modelValue')).toBe('active');
	expect(select.props('items')).toEqual([
		{ text: 'Show Active Items', value: 'active' },
		{ text: 'Show Archived Items', value: 'archived' },
		{ text: 'Show All Items', value: 'all' },
	]);
});

test('sets the archive query and keeps the other query keys', async () => {
	const { router, select } = await setup('/content/articles?bookmark=3&all');

	select.vm.$emit('update:modelValue', 'archived');
	await flushPromises();

	expect(router.currentRoute.value.fullPath).toBe('/content/articles?bookmark=3&archived=');
});

test('not archived removes the archive query', async () => {
	const { router, select } = await setup('/content/articles?archived&bookmark=3', 'archived');

	expect(select.props('modelValue')).toBe('archived');

	select.vm.$emit('update:modelValue', 'active');
	await flushPromises();

	expect(router.currentRoute.value.fullPath).toBe('/content/articles?bookmark=3');
});

test('follows the archive prop', async () => {
	const { wrapper, select } = await setup('/content/articles');

	await wrapper.setProps({ archive: 'all' });

	expect(select.props('modelValue')).toBe('all');
});
