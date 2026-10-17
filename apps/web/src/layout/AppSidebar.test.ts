import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import type { ModuleBarPart } from '../constants.ts';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useSettingsStore, type Settings } from '../stores/settings.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import AppSidebar from './AppSidebar.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

beforeEach(() => localStorage.clear());

/** Text of an element without its aria-hidden parts (icon ligatures). */
function accessibleText(el: Element) {
	const clone = el.cloneNode(true) as Element;
	clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
	return clone.textContent!.replace(/\s+/g, ' ').trim();
}

async function render(
	moduleBar: ModuleBarPart[] | null,
	{
		path = '/',
		modules = getInternalModules().map((m) => m.id),
		props = {},
		slots = {},
	}: { path?: string; modules?: string[]; props?: Record<string, unknown>; slots?: Record<string, string> } = {},
) {
	registeredModules.value = getInternalModules().filter((m) => modules.includes(m.id));

	const { wrapper } = await mountLayout(AppSidebar, {
		path,
		props,
		slots,
		beforeMount: () => {
			useSettingsStore().settings = { module_bar: moduleBar } as Settings;
		},
	});

	const links = [...document.body.querySelectorAll('[data-testid="module-bar"] a')];

	return {
		wrapper,
		links,
		hrefs: links.map((a) => a.getAttribute('href')),
		labels: links.map(accessibleText),
	};
}

describe('AppSidebar module list (FR-021)', () => {
	test('module_bar null: Directus default order without Documentation, Settings last', async () => {
		const { hrefs, labels, wrapper } = await render(null);

		expect(hrefs).toEqual(['/content', '/users', '/files', '/insights', '/settings']);
		expect(labels).toEqual(['Content', 'User Directory', 'File Library', 'Insights', 'Settings']);
		expect(wrapper.get('aside').attributes('aria-label')).toBe('Navigation');
		const nav = wrapper.get('nav');
		expect(document.getElementById(nav.attributes('aria-labelledby')!)!.textContent).toContain('Modules');
	});

	test('no settings yet: no module buttons', async () => {
		registeredModules.value = getInternalModules();
		const { wrapper } = await mountLayout(AppSidebar);

		expect(wrapper.findAll('[data-testid="module-bar"] a')).toHaveLength(0);
	});

	test('share session (no settings): the default bar of its registered modules (FR-084)', async () => {
		registeredModules.value = getInternalModules().filter((m) => m.id === 'content');
		const { wrapper } = await mountLayout(AppSidebar, {
			beforeMount: () => {
				useUserStore().currentUser = { share: 's1', app_access: false, admin_access: false };
			},
		});

		expect(wrapper.findAll('[data-testid="module-bar"] a').map((a) => a.attributes('href'))).toEqual(['/content']);
	});

	test('saved order and enabled are used as is; unknown and unregistered modules are dropped', async () => {
		const { hrefs } = await render(
			[
				{ type: 'module', id: 'files', enabled: true },
				{ type: 'module', id: 'content', enabled: false },
				{ type: 'module', id: 'visual', enabled: true },
				{ type: 'module', id: 'unknown', enabled: true },
				{ type: 'module', id: 'settings', enabled: true, locked: true },
				{ type: 'module', id: 'users', enabled: true },
			],
			{ modules: ['activity', 'content', 'files', 'users'] },
		);

		expect(hrefs).toEqual(['/files', '/users']);
	});

	test('internal links are router links, external links open a new tab; $t: names are translated', async () => {
		const { links } = await render([
			{ type: 'link', id: 'activity', enabled: true, name: '$t:activity', icon: 'history', url: '/activity' },
			{ type: 'link', id: 'site', enabled: true, name: 'Site', icon: 'public', url: 'https://example.test' },
		]);

		expect(links[0]!.getAttribute('href')).toBe('/activity');
		expect(accessibleText(links[0]!)).toBe('Activity');
		expect(links[0]!.getAttribute('target')).toBeNull();
		expect(links[1]!.getAttribute('href')).toBe('https://example.test');
		expect(links[1]!.getAttribute('target')).toBe('_blank');
		expect(links[1]!.getAttribute('rel')).toBe('noopener noreferrer');
		expect(accessibleText(links[1]!)).toBe('Site (Open in New Window)');
	});

	test('the Documentation link to the Directus docs is hidden even in a saved module_bar (FR-081, D-49)', async () => {
		const docs = { type: 'link', id: 'docs', enabled: true, name: '$t:documentation', icon: 'help' } as const;

		const saved = await render([
			{ type: 'module', id: 'content', enabled: true },
			{ ...docs, url: 'https://docs.directus.io' },
		]);
		expect(saved.hrefs).toEqual(['/content']);

		saved.wrapper.unmount();
		const changed = await render([{ ...docs, url: 'https://docs.example.test' }]);
		expect(changed.hrefs).toEqual(['https://docs.example.test']);
	});

	test('the active module has aria-current="page", also on a sub path', async () => {
		const { links } = await render(null, { path: '/files/folders/1' });

		expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, null, 'page', null, null]);
		expect(links[2]!.className).toContain('menu-item-active');
	});
});

describe('AppSidebar layout (FR-020, layout-patterns §2)', () => {
	test('the navigation slot is the sub-menu of the active module only', async () => {
		await render(null, { path: '/files', slots: { navigation: '<a href="/files/x">Folder</a>' } });

		const items = [...document.body.querySelectorAll('[data-testid="module-bar"] > ul > li')];
		expect(items.map((li) => li.textContent!.includes('Folder'))).toEqual([false, false, true, false, false]);
	});

	test('a hidden module (Activity) gets a row with its name, not a link, holding its sub-menu (018 FR-061)', async () => {
		await render(null, { path: '/activity', slots: { navigation: '<button type="button">My Activity</button>' } });

		const row = document.body.querySelector('[data-module-unlisted]')!;
		expect(accessibleText(row)).toContain('Activity');
		expect(row.querySelector('a')).toBeNull();
		expect(row.textContent).toContain('My Activity');
		expect(document.body.querySelectorAll('[data-testid="module-bar"] [aria-current="page"]')).toHaveLength(0);
	});

	test('from xl: 290 px, collapsed to the 90 px rail (labels kept for screen readers), hover expands it', async () => {
		const { wrapper } = await render(null, { path: '/files', slots: { navigation: '<p>Sub</p>' } });
		const aside = wrapper.get('aside');
		expect(aside.classes()).toContain('w-[290px]');

		useNavBarStore().collapse();
		await nextTick();
		expect(aside.classes()).toContain('w-[90px]');
		expect(wrapper.findAll('[data-testid="module-bar"] a span.sr-only').map((s) => s.text())).toContain('Content');
		expect(wrapper.text()).not.toContain('Sub');

		await aside.trigger('mouseenter');
		expect(aside.classes()).toContain('w-[290px]');
		expect(wrapper.text()).toContain('Sub');

		await aside.trigger('mouseleave');
		expect(aside.classes()).toContain('w-[90px]');
	});

	test('below xl: a modal drawer opened from the store, Esc closes it', async () => {
		await render(null, { props: { drawer: true } });
		const navBarStore = useNavBarStore();

		expect(document.body.querySelector('[data-testid="module-bar"]')).toBeNull();

		navBarStore.drawerOpen = true;
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"] aside#navigation')).not.toBeNull());
		expect(document.body.querySelectorAll('[role="dialog"] [data-testid="module-bar"] a')).toHaveLength(5);

		await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
		expect(navBarStore.drawerOpen).toBe(false);
	});
});
