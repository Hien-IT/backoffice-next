// Directus has no test for its marketplace registry page (spec 020 T175, recipe Q-42, rows 204 and 210): the request
// built from the route query (`search`, `type`, `sort`, `page`) like the Directus axios call, the debounced search
// written back to the query, page reset on a filter change, rows (name, chips, installed), empty and error states.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { assertOnlyKnownRequests, calls, json, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import RegistryRoute from './RegistryRoute.vue';
import { MARKETPLACE_TEST_ROUTES } from './test-routes.ts';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const item = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	name: `directus-extension-${id}`,
	description: `About ${id}`,
	total_downloads: 12_345,
	verified: false,
	type: 'interface',
	last_updated: '2026-10-01T00:00:00.000Z',
	host_version: '^11.0.0',
	sandbox: false,
	license: 'mit',
	publisher: { username: 'jane', verified: true, github_name: 'Jane Doe' },
	...extra,
});

function api(
	list: unknown[] = [item('color-picker'), item('audit-log', { type: 'hook', description: null })],
	count = 2,
) {
	return mockApi({
		'GET /extensions': [{ id: 'audit-log', bundle: null, schema: { type: 'hook' }, meta: { enabled: true } }],
		'GET /extensions/registry': () => json({ meta: { filter_count: count }, data: list }),
	});
}

const registryCalls = (fetch: ReturnType<typeof api>) =>
	calls(fetch).filter((c) => c.startsWith('GET /extensions/registry'));

/** The request queue answers after a few ticks: wait until nothing is loading. */
async function settled(wrapper: { find: (s: string) => { exists: () => boolean } }) {
	await vi.waitFor(() => expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false));
	await flushPromises();
}

async function mountRoute(path = '/settings/marketplace') {
	const { wrapper, router } = await mountLayout(RegistryRoute, { path, routes: MARKETPLACE_TEST_ROUTES });
	await settled(wrapper);
	return { wrapper, router };
}

test('first request: Directus defaults (limit 10, offset 0, sort popular), rows with type and installed chips', async () => {
	const fetch = api();
	const { wrapper } = await mountRoute();

	expect(registryCalls(fetch)).toEqual(['GET /extensions/registry?limit=10&offset=0&sort=popular']);
	assertOnlyKnownRequests(calls(fetch));

	const rows = wrapper.findAll('li a');
	expect(rows.map((row) => row.attributes('href'))).toEqual([
		'/settings/marketplace/extension/color-picker',
		'/settings/marketplace/extension/audit-log',
	]);
	expect(rows[0]!.text()).toContain('Color Picker');
	expect(rows[0]!.text()).toContain('Interface');
	expect(rows[0]!.text()).toContain('Jane Doe');
	expect(rows[0]!.text()).toContain('12K');
	expect(rows[0]!.text()).not.toContain('Installed');
	expect(rows[0]!.find('[role="img"]').attributes('aria-label')).toBe('Verified');
	expect(rows[1]!.text()).toContain('Installed');
	expect(rows[1]!.text()).toContain('No description...');
	expect(wrapper.text()).toContain('2 Items');
	expect(wrapper.find('nav[aria-label="Marketplace"]').exists()).toBe(false);
});

test('the route query drives the request; a filter change sends page back to 1', async () => {
	const fetch = api([item('color-picker')], 25);
	const { wrapper, router } = await mountRoute('/settings/marketplace?search=color&type=interface&sort=recent&page=2');

	expect(registryCalls(fetch)).toEqual([
		'GET /extensions/registry?search=color&limit=10&offset=10&filter[type][_eq]=interface&sort=recent',
	]);
	// filtered by type: no type chip
	expect(wrapper.get('li a').text()).not.toContain('Interface');

	await router.push({ query: { ...router.currentRoute.value.query, sort: 'downloads' } });
	await vi.waitFor(() => expect(registryCalls(fetch)).toHaveLength(2));
	await settled(wrapper);

	expect(router.currentRoute.value.query['page']).toBeUndefined();
	expect(registryCalls(fetch).at(-1)).toBe(
		'GET /extensions/registry?search=color&limit=10&offset=0&filter[type][_eq]=interface&sort=downloads',
	);
});

test('pagination writes the page to the query', async () => {
	const fetch = api([item('color-picker')], 25);
	const { wrapper, router } = await mountRoute();

	const nav = wrapper.get('nav[aria-label="Marketplace"]');
	await nav
		.findAll('button')
		.find((b) => b.text() === '2')!
		.trigger('click');
	await vi.waitFor(() => expect(router.currentRoute.value.query['page']).toBe('2'));
	await vi.waitFor(() => expect(registryCalls(fetch)).toHaveLength(2));

	expect(registryCalls(fetch).at(-1)).toBe('GET /extensions/registry?limit=10&offset=10&sort=popular');
});

test('the search input writes `search` after the Directus 300 ms debounce, empty removes it', async () => {
	api();
	const { wrapper, router } = await mountRoute();
	const input = wrapper.get('input[type="search"]');

	expect(document.activeElement).toBe(input.element);

	await input.setValue('audit');
	expect(router.currentRoute.value.query['search']).toBeUndefined();
	await new Promise((resolve) => setTimeout(resolve, 350));
	await flushPromises();
	expect(router.currentRoute.value.query['search']).toBe('audit');

	await input.setValue('');
	await new Promise((resolve) => setTimeout(resolve, 350));
	await flushPromises();
	expect(router.currentRoute.value.query['search']).toBeUndefined();
});

test('empty result: no results info', async () => {
	api([], 0);
	const { wrapper } = await mountRoute('/settings/marketplace?search=nothing');

	expect(wrapper.findAll('li')).toHaveLength(0);
	expect(wrapper.text()).toContain('No Results');
	expect(wrapper.text()).toContain('Adjust or clear search filters to see results.');
});

test('registry error: the reason of the API error in a danger notice', async () => {
	mockApi({
		'GET /extensions': [],
		'GET /extensions/registry': () =>
			json(
				{
					errors: [
						{
							message: 'Service "extensions" is unavailable. Couldn\'t reach the registry.',
							extensions: { code: 'SERVICE_UNAVAILABLE' },
						},
					],
				},
				503,
			),
	});
	const { wrapper } = await mountRoute();

	expect(wrapper.text()).toContain('Service "extensions" is unavailable. Couldn\'t reach the registry.');
	expect(wrapper.findAll('li')).toHaveLength(0);
});
