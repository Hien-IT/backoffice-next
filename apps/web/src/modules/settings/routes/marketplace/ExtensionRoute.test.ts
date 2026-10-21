// Directus has no test for its marketplace extension page (spec 020 T175, recipe Q-43, rows 204, 209 and 211): the
// banner, the readme (sanitized, links in a new tab), the metadata rows, compatibility with semver against the server
// version, and the install button of extension-install.vue (install → refresh → Manage; disabled at the limit, R-60).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { useServerStore } from '../../../../stores/server.ts';
import { assertOnlyKnownRequests, calls, json, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import ExtensionRoute from './ExtensionRoute.vue';
import { MARKETPLACE_TEST_ROUTES } from './test-routes.ts';

vi.mock('../../../../panels/shared/apex-charts.ts', () => ({
	loadApexCharts: async () =>
		class {
			render() {}
			destroy() {}
		},
}));

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	resetNotices();
});

const publisher = {
	id: 'acc-1',
	username: 'jane',
	verified: true,
	github_name: 'Jane Doe',
	github_avatar_url: 'https://avatars.test/jane.png',
};

const extension = (extra: Record<string, unknown> = {}, version: Record<string, unknown> = {}) => ({
	id: 'ext-1',
	name: '@acme/directus-extension-color-picker',
	description: 'Pick colors',
	total_downloads: 1234,
	downloads: [
		{ date: '2026-10-05', count: 3 },
		{ date: '2026-10-12', count: 7 },
	],
	verified: false,
	readme: '# Color picker\n\nSee [docs](https://docs.test) <script>alert(1)</script>',
	type: 'interface',
	license: 'mit',
	versions: [
		{
			id: 'ver-2',
			version: '2.0.0',
			verified: false,
			type: 'interface',
			host_version: '^11.0.0',
			publish_date: '2026-10-01T00:00:00.000Z',
			unpacked_size: 12_500,
			file_count: 4,
			url_bugs: 'https://bugs.test',
			url_homepage: 'https://home.test',
			url_repository: null,
			license: 'mit',
			publisher,
			bundled: [],
			maintainers: [
				{ accounts_id: publisher },
				{
					accounts_id: {
						...publisher,
						id: 'acc-2',
						username: 'bob',
						github_name: null,
						github_avatar_url: null,
						verified: false,
					},
				},
			],
			...version,
		},
	],
	...extra,
});

type Installed = { id: string }[];

async function mountRoute({
	data = extension(),
	installed = [] as Installed,
	limit = null as number | null,
	serverVersion = '11.17.4',
} = {}) {
	let list = installed;

	const fetch = mockApi({
		'GET /extensions': () => json({ data: list.map(({ id }) => ({ id, bundle: null, schema: null, meta: {} })) }),
		'GET /extensions/registry/extension/ext-1': data,
		'POST /extensions/registry/install': () => {
			list = [...list, { id: 'ext-1' }];
			return new Response(null, { status: 204 });
		},
	});

	const { wrapper } = await mountLayout(ExtensionRoute, {
		path: '/settings/marketplace/extension/ext-1',
		routes: MARKETPLACE_TEST_ROUTES,
		props: { extensionId: 'ext-1' },
		beforeMount: (pinia) => {
			const server = useServerStore(pinia);
			server.info.version = serverVersion;
			server.info.extensions = { limit };
		},
	});

	await vi.waitFor(() => expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false));
	await flushPromises();

	return { wrapper, fetch };
}

const installButton = (wrapper: Awaited<ReturnType<typeof mountRoute>>['wrapper']) =>
	wrapper.findAll('button').find((b) => b.text().includes('Install Extension'));

test('banner, readme, metadata rows and authors', async () => {
	const { wrapper, fetch } = await mountRoute();

	expect(calls(fetch)).toContain('GET /extensions/registry/extension/ext-1');
	assertOnlyKnownRequests(calls(fetch));

	expect(wrapper.get('h2').text()).toBe('Color Picker');
	expect(wrapper.text()).toContain('Pick colors');
	expect(wrapper.text()).toContain('v2.0.0 •');

	const readme = wrapper.get('[data-readme]');
	expect(readme.get('h1').text()).toBe('Color picker');
	expect(readme.get('a').attributes()).toMatchObject({
		href: 'https://docs.test',
		target: '_blank',
		rel: 'noopener noreferrer',
	});
	expect(readme.find('script').exists()).toBe(false);

	const text = wrapper.text();
	expect(text).toContain('1,234 Downloads');
	expect(text).toContain('v2.0.0');
	expect(text).toContain('Compatible with your Project');
	expect(text).toContain('12.5 kB (4 Files)');
	expect(text).toContain('mit');

	const links = wrapper.findAll('a[target="_blank"]').filter((a) => !a.element.closest('[data-readme]'));
	expect(links.map((a) => [a.text(), a.attributes('href'), a.attributes('rel')])).toEqual([
		['linkHomepage', 'https://home.test', 'noopener noreferrer'],
		['bug_reportReport an Issue', 'https://bugs.test', 'noopener noreferrer'],
	]);

	// publisher first, the maintainer that is the publisher only once
	const authors = wrapper.findAll('a[href^="/settings/marketplace/account/"]');
	expect(authors.map((a) => a.attributes('href'))).toEqual([
		'/settings/marketplace/account/acc-1',
		'/settings/marketplace/account/acc-2',
	]);
	expect(authors[0]!.get('img').attributes('alt')).toBe('Jane Doe');
	expect(authors[1]!.text()).toContain('bob');

	// weekly downloads as an sr-only table under the aria-hidden chart
	expect(wrapper.findAll('[data-chart-table] tbody tr').map((tr) => tr.text())).toEqual(['2026-10-053', '2026-10-127']);
});

test('compatibility: semver of the server version against host_version', async () => {
	const { wrapper } = await mountRoute({ data: extension({}, { host_version: '^10.0.0' }) });

	expect(wrapper.text()).toContain('Compatibility not guaranteed');
	expect(wrapper.find('[data-icon="warning"]').exists()).toBe(true);
});

test('install: POST with the latest version, then the store refresh turns the button into Manage', async () => {
	const { wrapper, fetch } = await mountRoute();

	await installButton(wrapper)!.trigger('click');
	await vi.waitFor(() => expect(wrapper.text()).toContain('Manage'));

	const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
	expect(JSON.parse(post[1]!.body as string)).toEqual({ extension: 'ext-1', version: 'ver-2' });
	expect(calls(fetch).filter((c) => c === 'GET /extensions')).toHaveLength(2);
	expect(wrapper.find('a[href="/settings/extensions"]').exists()).toBe(true);
	expect(installButton(wrapper)).toBeUndefined();
	assertOnlyKnownRequests(calls(fetch));
});

test('installed already: Manage links to Settings > Extensions', async () => {
	const { wrapper } = await mountRoute({ installed: [{ id: 'ext-1' }] });

	expect(wrapper.get('a[href="/settings/extensions"]').text()).toContain('Manage');
	expect(installButton(wrapper)).toBeUndefined();
});

test('at the extensions limit the install button is disabled (R-60)', async () => {
	const { wrapper, fetch } = await mountRoute({ installed: [{ id: 'other' }], limit: 1 });

	const button = installButton(wrapper)!;
	expect(button.attributes('disabled')).toBeDefined();
	await button.trigger('click');
	expect(calls(fetch)).not.toContain('POST /extensions/registry/install');
});

test('below the limit the install button is enabled', async () => {
	const { wrapper } = await mountRoute({ installed: [{ id: 'other' }], limit: 2 });

	expect(installButton(wrapper)!.attributes('disabled')).toBeUndefined();
});

test('no readme: the Directus notice', async () => {
	const { wrapper } = await mountRoute({ data: extension({ readme: null }) });

	expect(wrapper.find('[data-readme]').exists()).toBe(false);
	expect(wrapper.text()).toContain('This extension does not have a README file.');
});

test('unknown extension: the API error and a link back to the registry', async () => {
	const { wrapper } = await mountRoute({
		data: (() =>
			json({ errors: [{ message: 'Extension not found', extensions: { code: 'NOT_FOUND' } }] }, 404)) as never,
	});

	expect(wrapper.text()).toContain('Extension not found');
	// the page back button links there too; the notice link is the last one
	expect(wrapper.findAll('a[href="/settings/marketplace"]').at(-1)!.text()).toContain('Marketplace');
});
