// Spec 033 T035 (FR-041, FR-043, SC-009; contracts/tests.md §2): the documentation area with the app CSS in a real
// browser: axe (wcag2a/aa, wcag21a/aa; serious and critical) in light and `html.dark`, the order of the three zones, the
// narrow layout, and the reading position when the theme or the language changes.
import { page as browser } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { renderDoc } from '../../../docs/render.ts';
import { i18n } from '../../../lang/index.ts';
import '../../../styles/index.css';
import { mountLayout } from '../../../test-utils/layout.ts';
import DocsArticle from '../components/DocsArticle.vue';
import DocsRoute from './DocsRoute.vue';

enableAutoUnmount(afterEach);

afterEach(() => {
	document.documentElement.classList.remove('dark');
	i18n.global.locale.value = 'en-US';
	window.scrollTo(0, 0);
});

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const ROUTES: RouteRecordRaw[] = [
	{ path: '/docs/:path(.*)*', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function open(path: string, width = 1440) {
	await browser.viewport(width, 900);
	const mounted = await mountLayout(DocsRoute, { path, routes: ROUTES });
	await vi.waitFor(() => expect(mounted.wrapper.find('[data-docs-loading]').exists()).toBe(false));
	await flushPromises();
	return mounted;
}

async function serious(): Promise<string[]> {
	// Transitions settled before colours are measured, as the E2E a11y spec does.
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
		.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

describe.each(['light', 'dark'] as const)('axe (%s)', (scheme) => {
	const theme = () => document.documentElement.classList.toggle('dark', scheme === 'dark');

	test('the introduction page', async () => {
		theme();
		await open('/docs');

		expect(await serious()).toEqual([]);
	});

	test('a configuration page', async () => {
		theme();
		await open('/docs/configuration/security');

		expect(await serious()).toEqual([]);
	});

	// Spec 033 T062: an API page with REST and GraphQL tabs, parameter and body tables, the Backoffice notice.
	test('API pages: Files and the Backoffice routes', async () => {
		theme();
		await open('/docs/api/files');
		expect(await serious()).toEqual([]);

		await open('/docs/api/backoffice');
		expect(await serious()).toEqual([]);
	});

	test('an article with code in the three languages, a table, both note boxes and a quote', async () => {
		theme();
		const { html } = renderDoc(
			[
				'## Ví dụ',
				'',
				'Đoạn văn có `mã trong dòng` và một [link](/docs).',
				'',
				'```bash',
				'# Lấy danh sách file',
				'curl -H "Authorization: Bearer <token>" "https://backoffice.example.com/files?limit=2"',
				'```',
				'',
				'```json',
				'{ "data": [{ "id": 1, "active": true, "title": null }] }',
				'```',
				'',
				'```graphql',
				'query { files(limit: 2) { id title } }',
				'```',
				'',
				'| Biến | Mô tả |',
				'| --- | --- |',
				'| `PORT` | Cổng |',
				'',
				'> [!NOTE]',
				'> Một lưu ý.',
				'',
				'> [!WARNING]',
				'> Một cảnh báo.',
				'',
				'> Một trích dẫn.',
			].join('\n'),
		);
		const router = createRouter({ history: createMemoryHistory(), routes: ROUTES });
		await router.push('/docs');

		const host = document.body.appendChild(document.createElement('main'));
		host.className = 'bg-white p-6 dark:bg-gray-900';
		mount(DocsArticle, { props: { html }, attachTo: host, global: { plugins: [i18n, router] } });

		expect(
			host.querySelectorAll('.docs-code .hljs-string, .docs-code .hljs-attr, .docs-code .hljs-keyword').length,
		).toBeGreaterThan(2);
		expect(await serious()).toEqual([]);
		host.remove();
	});
});

test('order: the documentation menu, then the article, then "On this page"; nothing takes a positive tabindex', async () => {
	const { wrapper } = await open('/docs');
	const menu = wrapper.find('[data-docs-navigation] a').element;
	const article = wrapper.find('.docs-article a').element;
	const toc = wrapper.find('[data-docs-toc] a').element;

	expect(menu.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(article.compareDocumentPosition(toc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(document.querySelectorAll('[data-docs] [tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).toHaveLength(0);
	expect(getComputedStyle(toc).display).not.toBe('none');
});

test('at 768 px: no "On this page" column and the page does not scroll sideways', async () => {
	const { wrapper } = await open('/docs/configuration/auth', 768);

	expect(getComputedStyle(wrapper.find('[data-docs-toc]').element).display).toBe('none');
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	// A wide table scrolls in its own box.
	const table = wrapper.find('.docs-table').element;
	expect(getComputedStyle(table).overflowX).toBe('auto');
});

test('changing the theme or the language keeps the reading position', async () => {
	await open('/docs/configuration/auth');
	window.scrollTo(0, 400);
	await flushPromises();
	const before = window.scrollY;
	expect(before).toBeGreaterThan(0);

	document.documentElement.classList.add('dark');
	i18n.global.locale.value = 'vi-VN';
	await flushPromises();

	expect(window.scrollY).toBe(before);
});
