// Spec 033 T021 (FR-003, Q-50).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { DocsNav } from '../../../docs/types.ts';
import { i18n } from '../../../lang/index.ts';
import DocsNavigation from './DocsNavigation.vue';

// A small table of contents with a titled group; the real one has no guides before wave 3.
vi.mock('../../../docs/nav.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../docs/nav.ts')>();
	const page = (path: string, title: string) => ({ path, title, lead: 'x', kind: 'markdown' as const, source: 'x' });
	const docsNav: DocsNav = {
		intro: page('', 'Bắt đầu'),
		sections: [
			{
				id: 'guides',
				titleKey: 'docs_guides',
				groups: [
					{ title: 'Module', pages: [page('guides/content', 'Content'), page('guides/files', 'Files')] },
					{ title: 'Tính năng riêng', pages: [page('guides/passkey', 'Passkey')] },
				],
			},
			{ id: 'api', titleKey: 'docs_api', groups: [] },
			{
				id: 'configuration',
				titleKey: 'docs_configuration',
				groups: [{ pages: [page('configuration/general', 'Chung')] }],
			},
		],
	};
	return { ...actual, docsNav };
});

enableAutoUnmount(afterEach);

async function navigation(path: string) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/docs/:path(.*)*', component: { render: () => null } },
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
	});
	await router.push(path);
	return mount(DocsNavigation, { global: { plugins: [i18n, router] } });
}

const links = (wrapper: Awaited<ReturnType<typeof navigation>>) =>
	wrapper.findAll('a').map((a) => a.attributes('href'));

describe('DocsNavigation', () => {
	test('a named navigation with the introduction, the parts that have pages, and their pages', async () => {
		const wrapper = await navigation('/docs');

		expect(wrapper.find('nav').attributes('aria-label')).toBe('Documentation');
		expect(wrapper.findAll('section').map((section) => section.attributes('data-docs-section'))).toEqual([
			'guides',
			'configuration',
		]);
		expect(wrapper.findAll('section > p').map((p) => p.text())).toEqual(['Guides', 'Configuration']);
		expect(links(wrapper)).toEqual([
			'/docs',
			'/docs/guides/content',
			'/docs/guides/files',
			'/docs/guides/passkey',
			'/docs/configuration/general',
		]);
	});

	test('the open page is the current one', async () => {
		const wrapper = await navigation('/docs/guides/files');
		const current = wrapper.findAll('a').filter((a) => a.attributes('aria-current') === 'page');

		expect(current.map((a) => a.attributes('href'))).toEqual(['/docs/guides/files']);
		expect(current[0]!.classes()).toContain('menu-dropdown-item-active');
		expect((await navigation('/docs')).find('a[aria-current="page"]').attributes('href')).toBe('/docs');
	});

	test('a titled group collapses and opens; the group of the open page stays open', async () => {
		const wrapper = await navigation('/docs/guides/files');
		const [module, feature] = wrapper.findAll('button');

		expect(module!.text()).toContain('Module');
		expect(module!.attributes('aria-expanded')).toBe('true');
		expect(feature!.attributes('aria-expanded')).toBe('true');

		await feature!.trigger('click');
		expect(feature!.attributes('aria-expanded')).toBe('false');
		expect(wrapper.find('a[href="/docs/guides/passkey"]').element.closest('ul')!.style.display).toBe('none');

		await feature!.trigger('click');
		expect(feature!.attributes('aria-expanded')).toBe('true');

		// The group that holds the open page cannot hide it.
		await module!.trigger('click');
		expect(module!.attributes('aria-expanded')).toBe('true');
	});
});
