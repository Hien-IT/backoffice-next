import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ModuleBarPart } from '../constants.ts';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useSettingsStore, type Settings } from '../stores/settings.ts';
import { mountLayout } from '../test-utils/layout.ts';
import ModuleBar from './ModuleBar.vue';

vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

async function render(
	moduleBar: ModuleBarPart[] | null,
	{ path = '/', modules = getInternalModules().map((m) => m.id) }: { path?: string; modules?: string[] } = {},
) {
	registeredModules.value = getInternalModules().filter((m) => modules.includes(m.id));

	const { wrapper } = await mountLayout(ModuleBar, {
		path,
		beforeMount: () => {
			useSettingsStore().settings = { module_bar: moduleBar } as Settings;
		},
	});

	const links = wrapper.findAll('[data-testid="module-bar"] a');

	return {
		wrapper,
		links,
		hrefs: links.map((a) => a.attributes('href')),
		labels: links.map((a) => a.attributes('aria-label')),
	};
}

describe('ModuleBar (FR-021)', () => {
	test('module_bar null: Directus default order without Documentation, Settings last', async () => {
		const { hrefs, labels, wrapper } = await render(null);

		expect(hrefs).toEqual(['/content', '/users', '/files', '/insights', '/settings']);
		expect(labels).toEqual(['Content', 'User Directory', 'File Library', 'Insights', 'Settings']);
		expect(wrapper.get('nav').attributes('aria-label')).toBe('Modules');
	});

	test('no settings yet: no module buttons', async () => {
		registeredModules.value = getInternalModules();
		const { wrapper } = await mountLayout(ModuleBar);

		expect(wrapper.findAll('[data-testid="module-bar"] a')).toHaveLength(0);
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

		expect(links[0]!.attributes()).toMatchObject({ href: '/activity', 'aria-label': 'Activity' });
		expect(links[0]!.attributes('target')).toBeUndefined();
		expect(links[1]!.attributes()).toMatchObject({
			href: 'https://example.test',
			target: '_blank',
			rel: 'noopener noreferrer',
			'aria-label': 'Site',
		});
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

		expect(links.map((a) => a.attributes('aria-current'))).toEqual([
			undefined,
			undefined,
			'page',
			undefined,
			undefined,
		]);
	});
});
