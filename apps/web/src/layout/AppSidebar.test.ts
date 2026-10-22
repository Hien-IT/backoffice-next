import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useSettingsStore, type Settings } from '../stores/settings.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import AppSidebar from './AppSidebar.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

beforeEach(() => localStorage.clear());

async function render({ path = '/files', props = {} }: { path?: string; props?: Record<string, unknown> } = {}) {
	registeredModules.value = getInternalModules();

	return mountLayout(AppSidebar, {
		path,
		props,
		slots: { navigation: '<a href="/files/x">Folder</a>' },
		beforeMount: () => {
			useSettingsStore().settings = { module_bar: null } as Settings;
		},
	});
}

describe('AppSidebar (layout-patterns §2, D-157)', () => {
	test('the open module: its name as the title, the actions target, then its navigation', async () => {
		const { wrapper } = await render();
		const aside = wrapper.get('aside#navigation');

		expect(aside.attributes('aria-label')).toBe('File Library');
		expect(aside.get('h2').text()).toBe('File Library');
		expect(aside.find('#module-actions-files').exists()).toBe(true);
		expect(aside.get('[data-module-navigation]').text()).toBe('Folder');
		// The modules are the top bar tabs now.
		expect(aside.find('[data-testid="module-bar"]').exists()).toBe(false);
	});

	test('a module without a place in the bar (Activity, 018 FR-061) still heads its navigation', async () => {
		const { wrapper } = await render({ path: '/activity' });
		expect(wrapper.get('aside h2').text()).toBe('Activity');
	});

	test('from xl: 290 px under the top bar; the header toggle hides it (saved)', async () => {
		const { wrapper } = await render();
		expect(wrapper.get('aside').classes()).toEqual(expect.arrayContaining(['w-[290px]', 'top-16']));

		useNavBarStore().collapse();
		await nextTick();
		expect(wrapper.find('aside').exists()).toBe(false);
	});

	test('below xl: a modal drawer opened from the store, Esc closes it', async () => {
		await render({ props: { drawer: true } });
		const navBarStore = useNavBarStore();

		expect(document.body.querySelector('aside#navigation')).toBeNull();

		navBarStore.drawerOpen = true;
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"] aside#navigation')).not.toBeNull());
		expect(document.body.querySelector('[role="dialog"] [data-module-navigation]')!.textContent).toBe('Folder');

		await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
		expect(navBarStore.drawerOpen).toBe(false);
	});
});
