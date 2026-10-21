// Spec 020 T175 (FR-106, recipes Q-42, Q-43): axe on the marketplace registry, extension and account pages, light and
// `html.dark`, over a mock API. 0 serious or critical violations.
import { page } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import axe from 'axe-core';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { Component } from 'vue';
import { replaceQueue } from '../../../../api/sdk.ts';
import { useServerStore } from '../../../../stores/server.ts';
import '../../../../styles/index.css';
import { json, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import AccountRoute from './AccountRoute.vue';
import ExtensionRoute from './ExtensionRoute.vue';
import RegistryRoute from './RegistryRoute.vue';
import { MARKETPLACE_TEST_ROUTES } from './test-routes.ts';

enableAutoUnmount(afterEach);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const PUBLISHER = { id: 'acc-1', username: 'jane', verified: true, github_name: 'Jane Doe', github_avatar_url: null };

const ITEM = {
	id: 'ext-1',
	name: 'directus-extension-color-picker',
	description: 'Pick colors',
	total_downloads: 1234,
	verified: false,
	type: 'interface',
	last_updated: '2026-10-01T00:00:00.000Z',
	host_version: '^11.0.0',
	sandbox: false,
	license: 'mit',
	publisher: PUBLISHER,
};

const EXTENSION = {
	...ITEM,
	downloads: [
		{ date: '2026-10-05', count: 3 },
		{ date: '2026-10-12', count: 7 },
	],
	readme: '# Color picker\n\nSee [the docs](https://docs.test).\n\n```js\nconsole.log(1)\n```',
	versions: [
		{
			id: 'ver-1',
			version: '1.0.0',
			verified: false,
			type: 'interface',
			host_version: '^10.0.0',
			publish_date: '2026-10-01T00:00:00.000Z',
			unpacked_size: 12_500,
			file_count: 4,
			url_bugs: 'https://bugs.test',
			url_homepage: 'https://home.test',
			url_repository: 'https://repo.test',
			license: 'mit',
			publisher: PUBLISHER,
			bundled: [],
			maintainers: null,
		},
	],
};

const ACCOUNT = {
	id: 'acc-1',
	username: 'jane',
	verified: true,
	github_username: 'janedoe',
	github_avatar_url: null,
	github_name: 'Jane Doe',
	github_company: 'Acme',
	github_blog: 'https://jane.test',
	github_location: 'Hanoi',
	github_bio: 'Builds extensions',
};

let noTransitions: HTMLStyleElement;

beforeAll(async () => {
	await page.viewport(1440, 900);
	noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
});

afterAll(() => noTransitions.remove());

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	mockApi({
		'GET /extensions': [],
		'GET /extensions/registry': () =>
			json({
				meta: { filter_count: 25 },
				data: Array(10)
					.fill(ITEM)
					.map((i, n) => ({ ...i, id: `ext-${n}` })),
			}),
		'GET /extensions/registry/extension/ext-1': EXTENSION,
		'GET /extensions/registry/account/acc-1': ACCOUNT,
	});
});

afterEach(() => {
	document.documentElement.classList.remove('dark');
});

async function mountPage(component: Component, path: string, props: Record<string, unknown> = {}) {
	await mountLayout(component, {
		path,
		routes: MARKETPLACE_TEST_ROUTES,
		props,
		beforeMount: (pinia) => {
			useServerStore(pinia).info.version = '11.17.4';
		},
	});
	await vi.waitUntil(() => document.querySelector('main') && !document.querySelector('[aria-busy="true"]'), {
		timeout: 15_000,
	});
	await flushPromises();
}

async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

async function bothSchemes() {
	expect(await violations(), 'light').toEqual([]);
	document.documentElement.classList.add('dark');
	expect(await violations(), 'dark').toEqual([]);
	document.documentElement.classList.remove('dark');
}

const BLOCK = { timeout: 60_000 };

test('the registry', BLOCK, async () => {
	await mountPage(RegistryRoute, '/settings/marketplace');
	expect(document.querySelectorAll('main li a')).toHaveLength(10);
	await bothSchemes();
});

test('an extension (incompatible, readme, sparkline)', BLOCK, async () => {
	await mountPage(ExtensionRoute, '/settings/marketplace/extension/ext-1', { extensionId: 'ext-1' });
	expect(document.querySelector('[data-readme]')).not.toBeNull();
	await bothSchemes();
});

test('an account', BLOCK, async () => {
	await mountPage(AccountRoute, '/settings/marketplace/account/acc-1', { accountId: 'acc-1' });
	await vi.waitUntil(() => document.querySelector('main li a'), { timeout: 15_000 });
	await bothSchemes();
});
