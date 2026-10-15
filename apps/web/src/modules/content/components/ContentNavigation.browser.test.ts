import { userEvent } from '@vitest/browser/context';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { useUserStore } from '../../../stores/user.ts';
import '../../../styles/index.css';
import { useNavigation } from '../composables/use-navigation.ts';
import ContentNavigation from './ContentNavigation.vue';

function collection(name: string, meta: Record<string, unknown> = {}, schema = true): Collection {
	return {
		collection: name,
		name: name.toUpperCase(),
		icon: 'database',
		type: schema ? 'table' : 'alias',
		meta: { collection: name, group: null, hidden: false, sort: null, collapse: 'open', ...meta },
		schema: schema ? { name } : null,
	} as unknown as Collection;
}

// Real focus and key handling (FR-004b, layout-patterns §9).
test('WAI-ARIA tree keyboard: roving tabindex, arrows, Home/End, Enter', async () => {
	setActivePinia(createPinia());
	useCollectionsStore().collections = [
		collection('articles', { sort: 1 }),
		collection('folder', { sort: 2 }, false),
		collection('pages', { group: 'folder' }),
		collection('locked', { sort: 3, collapse: 'locked' }),
		collection('child', { group: 'locked' }),
	];
	useUserStore().currentUser = { id: 'me', admin_access: false } as never;
	useNavigation().activeGroups.value = [];

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/');

	const Page = defineComponent({
		setup: () => () => [h(ContentNavigation), h('button', { id: 'after' }, 'after')],
	});
	const wrapper = mount(Page, { global: { plugins: [i18n, router] }, attachTo: document.body });
	await flushPromises();

	const focusedKey = () => document.activeElement?.closest<HTMLElement>('[role="treeitem"]')?.dataset['key'];
	const expanded = (key: string) => document.querySelector(`[data-key="${key}"]`)?.getAttribute('aria-expanded');

	await userEvent.tab();
	expect(focusedKey()).toBe('articles');

	await userEvent.keyboard('{ArrowUp}');
	expect(focusedKey()).toBe('articles');

	await userEvent.keyboard('{ArrowDown}');
	expect(focusedKey()).toBe('folder');

	await userEvent.keyboard('{ArrowRight}');
	expect(expanded('folder')).toBe('true');
	expect(focusedKey()).toBe('folder');

	await userEvent.keyboard('{ArrowRight}');
	expect(focusedKey()).toBe('pages');

	await userEvent.keyboard('{ArrowLeft}');
	expect(focusedKey()).toBe('folder');

	await userEvent.keyboard('{ArrowLeft}');
	expect(expanded('folder')).toBe('false');

	await userEvent.keyboard('{Enter}');
	expect(expanded('folder')).toBe('true');

	await userEvent.keyboard('{End}');
	expect(focusedKey()).toBe('child');

	// Locked group: Left goes to the parent and does not close it.
	await userEvent.keyboard('{ArrowLeft}');
	expect(focusedKey()).toBe('locked');
	await userEvent.keyboard('{ArrowLeft}');
	expect(expanded('locked')).toBe('true');
	expect(focusedKey()).toBe('locked');

	await userEvent.keyboard('{Home}');
	expect(focusedKey()).toBe('articles');

	// One tab stop: Tab leaves the tree, Shift+Tab comes back to the last focused row.
	await userEvent.keyboard('{ArrowDown}');
	await userEvent.tab();
	expect(document.activeElement?.id).toBe('after');
	await userEvent.tab({ shift: true });
	expect(focusedKey()).toBe('folder');

	await userEvent.keyboard('{Home}{Enter}');
	await flushPromises();
	expect(router.currentRoute.value.fullPath).toBe('/content/articles');

	wrapper.unmount();
});
