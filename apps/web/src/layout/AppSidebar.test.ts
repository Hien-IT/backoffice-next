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
	test('one column (D-157, Arc style): logo and module tiles on the project color, the open module and its navigation, user and bell', async () => {
		const { wrapper } = await render();
		const aside = wrapper.get('aside#navigation');

		expect(aside.attributes('aria-label')).toBe('Navigation');
		const block = aside.get('[data-testid="module-rail"]');
		expect(block.classes()).toEqual(expect.arrayContaining(['bg-(--project-color)', 'rounded-2xl']));
		expect(block.find('img').exists()).toBe(true);
		expect(block.find('[data-testid="module-bar"] a[aria-current="page"]').attributes('href')).toBe('/files');
		expect(aside.get('h2').text()).toBe('File Library');
		expect(aside.find('#module-actions-files').exists()).toBe(true);
		expect(aside.get('[data-module-navigation]').text()).toBe('Folder');
		expect(aside.find('button[title="Notifications"]').exists()).toBe(true);
	});

	test('a module without a place in the bar (Activity, 018 FR-061) still heads its navigation', async () => {
		const { wrapper } = await render({ path: '/activity' });
		expect(wrapper.get('aside h2').text()).toBe('Activity');
	});

	test('from xl: 290 px at the start; the header toggle hides it (saved)', async () => {
		const { wrapper } = await render();
		expect(wrapper.get('aside').classes()).toContain('start-0');
		expect(wrapper.get('aside').element.style.width).toBe('290px');

		useNavBarStore().collapse();
		await nextTick();
		expect(wrapper.find('aside').exists()).toBe(false);
	});

	test('owner 2026-10-28: the end edge resizes the column (pointer, arrow keys), 240 to 480 px, saved', async () => {
		const { wrapper } = await render();
		const aside = wrapper.get('aside');
		const handle = aside.get('[role="separator"]');
		expect(handle.attributes()).toMatchObject({
			'aria-label': 'Resize navigation',
			'aria-valuenow': '290',
			'aria-valuemin': '240',
			'aria-valuemax': '480',
		});

		aside.element.getBoundingClientRect = () => ({ left: 0, right: 290 }) as DOMRect;
		handle.element.setPointerCapture = vi.fn();
		const pointer = (type: string, clientX: number) =>
			handle.element.dispatchEvent(new PointerEvent(type, { clientX, button: 0, pointerId: 1 }));

		pointer('pointerdown', 290);
		pointer('pointermove', 400);
		await nextTick();
		expect(aside.element.style.width).toBe('400px');
		pointer('pointermove', 1000);
		await nextTick();
		expect(aside.element.style.width).toBe('480px');
		handle.element.dispatchEvent(new Event('lostpointercapture'));
		pointer('pointermove', 300);
		await nextTick();
		expect(aside.element.style.width).toBe('480px');
		expect(localStorage.getItem('backoffice-nav-bar-size')).toBe('480');

		await handle.trigger('keydown', { key: 'ArrowLeft' });
		expect(aside.element.style.width).toBe('464px');
		useNavBarStore().size = 0;
		await nextTick();
		expect(aside.element.style.width).toBe('240px');
	});

	test('D-200: the card toggle makes it compact (small logo, icon tiles with their names kept), saved', async () => {
		const { wrapper } = await render();
		const block = wrapper.get('[data-testid="module-rail"]');
		const toggle = block.get('button[aria-label="Compact modules"]');
		const tile = () => block.get('[data-testid="module-bar"] a[href="/files"]');
		expect(toggle.attributes('aria-pressed')).toBe('false');
		expect(tile().get('span:not([aria-hidden])').classes()).toContain('truncate');

		await toggle.trigger('click');
		expect(toggle.attributes('aria-pressed')).toBe('true');
		expect(block.classes()).toContain('p-3');
		expect(block.find('span.size-8').exists()).toBe(true);
		expect(block.get('[data-testid="module-bar"] ul').classes()).toContain('grid-flow-col');
		expect(tile().get('span:not([aria-hidden])').classes()).toContain('sr-only');
		expect(tile().text()).toContain('File Library');
		expect(localStorage.getItem('backoffice-module-bar-compact')).toBe('true');

		await toggle.trigger('click');
		expect(block.find('span.size-8').exists()).toBe(false);
	});

	test('below xl: a modal drawer opened from the store, Esc closes it', async () => {
		await render({ props: { drawer: true } });
		const navBarStore = useNavBarStore();

		expect(document.body.querySelector('aside#navigation')).toBeNull();

		navBarStore.drawerOpen = true;
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"] aside#navigation')).not.toBeNull());
		expect(document.body.querySelector('[role="dialog"] [data-module-navigation]')!.textContent).toBe('Folder');

		// The first focused tile may show its tooltip: the first Escape can close that.
		await press(document.activeElement!, 'Escape');
		if (document.body.querySelector('[role="dialog"]')) await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
		expect(navBarStore.drawerOpen).toBe(false);
	});
});
