import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ModuleBarPart } from '../constants.ts';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useSettingsStore, type Settings } from '../stores/settings.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import ModuleTabs from './ModuleTabs.vue';

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
		extensions = [],
	}: {
		path?: string;
		modules?: string[];
		extensions?: string[];
	} = {},
) {
	registeredModules.value = [
		...getInternalModules().filter((m) => modules.includes(m.id)),
		// App extension modules (spec 020): only id, name and icon matter to the bar.
		...extensions.map((id) => ({ id, name: `Ext ${id}`, icon: 'box', routes: [] }) as any),
	];

	const { wrapper } = await mountLayout(ModuleTabs, {
		path,
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

/** Opens the "Links and extensions" menu and returns its items. */
async function openMore() {
	const button = document.body.querySelector<HTMLButtonElement>('[data-module-group="more"] button')!;
	button.focus();
	await press(button, 'Enter');
	await vi.waitFor(() => expect(document.body.querySelectorAll('[role^="menuitem"]').length).toBeGreaterThan(0));
	return [...document.body.querySelectorAll('[role^="menuitem"]')];
}

const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

describe('ModuleTabs module list (FR-021, D-157)', () => {
	test('module_bar null: Directus default order without Documentation, Settings last', async () => {
		const { hrefs, labels, wrapper } = await render(null);

		expect(hrefs).toEqual(['/content', '/users', '/files', '/insights', '/settings']);
		expect(labels).toEqual(['Content', 'User Directory', 'File Library', 'Insights', 'Settings']);
		expect(wrapper.get('nav').attributes('aria-label')).toBe('Modules');
	});

	test('no settings yet: no module buttons', async () => {
		registeredModules.value = getInternalModules();
		const { wrapper } = await mountLayout(ModuleTabs);

		expect(wrapper.findAll('[data-testid="module-bar"] a')).toHaveLength(0);
	});

	test('share session (no settings): the default bar of its registered modules (FR-084)', async () => {
		registeredModules.value = getInternalModules().filter((m) => m.id === 'content');
		const { wrapper } = await mountLayout(ModuleTabs, {
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

	test('module_bar links sit in the "Links and extensions" menu (D-162): internal router links, external in a new tab; $t: names translated', async () => {
		const { hrefs } = await render([
			{ type: 'module', id: 'content', enabled: true },
			{ type: 'link', id: 'activity', enabled: true, name: '$t:activity', icon: 'history', url: '/activity' },
			{ type: 'link', id: 'site', enabled: true, name: 'Site', icon: 'public', url: 'https://example.test' },
		]);

		expect(hrefs).toEqual(['/content']);
		const items = await openMore();
		expect(items.map((item) => [text(item), item.getAttribute('href'), item.getAttribute('target')])).toEqual([
			[expect.stringContaining('Activity'), '/activity', null],
			[expect.stringContaining('Site'), 'https://example.test', '_blank'],
		]);
		expect(items[1]!.getAttribute('rel')).toBe('noopener noreferrer');
	});

	test('the Documentation link to the Directus docs is hidden even in a saved module_bar (FR-081, D-49)', async () => {
		const docs = { type: 'link', id: 'docs', enabled: true, name: '$t:documentation', icon: 'help' } as const;

		const saved = await render([
			{ type: 'module', id: 'content', enabled: true },
			{ ...docs, url: 'https://docs.directus.io' },
		]);
		expect(saved.hrefs).toEqual(['/content']);
		expect(document.body.querySelector('[data-module-group="more"]')).toBeNull();

		saved.wrapper.unmount();
		await render([{ ...docs, url: 'https://docs.example.test' }]);
		expect((await openMore()).map((item) => item.getAttribute('href'))).toEqual(['https://docs.example.test']);
	});

	test('the active module has aria-current="page", also on a sub path', async () => {
		const { links } = await render(null, { path: '/files/folders/1' });

		expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, null, 'page', null, null]);
		expect(links[2]!.className).toContain('bg-white');
		expect(links[0]!.className).toContain('bg-white/10');
	});
});

describe('ModuleTabs Links and extensions menu (D-144, D-162)', () => {
	test('extension modules and links share the "Links and extensions" menu in module_bar order; active on their pages', async () => {
		const bar: ModuleBarPart[] = [
			{ type: 'module', id: 'content', enabled: true },
			{ type: 'module', id: 'report', enabled: true },
			{ type: 'module', id: 'hidden-ext', enabled: false },
			{ type: 'link', id: 'site', enabled: true, name: 'Site', icon: 'public', url: 'https://example.test' },
			{ type: 'module', id: 'viewer', enabled: true },
			{ type: 'module', id: 'settings', enabled: true, locked: true },
		];
		const { hrefs } = await render(bar, { path: '/report/schema', extensions: ['report', 'hidden-ext', 'viewer'] });

		expect(hrefs).toEqual(['/content', '/settings']);
		const button = document.body.querySelector<HTMLButtonElement>('[data-module-group="more"] button')!;
		expect(button.textContent!.replace(/\s+/g, ' ')).toContain('More: Links and extensions');
		expect(button.className).toContain('bg-white');

		const items = await openMore();
		expect(items.map(text)).toEqual([
			expect.stringContaining('Ext report'),
			expect.stringContaining('Site'),
			expect.stringContaining('Ext viewer'),
		]);
		expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
	});

	test('no menu tile without extension modules or links in the bar', async () => {
		await render(null, { path: '/files', extensions: ['report'] });
		expect(document.body.querySelector('[data-module-group="more"]')).toBeNull();
	});
});
