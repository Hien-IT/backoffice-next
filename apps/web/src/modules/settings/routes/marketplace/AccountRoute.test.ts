// DR has no test for its marketplace account page (spec 020 T175, recipe Q-43, rows 204, 210 and 212): the
// banner and metadata of the account, its extensions (`filter[by][_eq]`, 6 per page, DR Math.round page count)
// and the error state.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { assertOnlyKnownRequests, calls, json, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import AccountRoute from './AccountRoute.vue';
import { MARKETPLACE_TEST_ROUTES } from './test-routes.ts';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	resetNotices();
});

const ACCOUNT = {
	id: 'acc-1',
	username: 'jane',
	verified: true,
	github_username: 'janedoe',
	github_avatar_url: 'https://avatars.test/jane.png',
	github_name: 'Jane Doe',
	github_company: 'Acme',
	github_blog: 'https://jane.test',
	github_location: 'Hanoi',
	github_bio: 'Builds extensions',
};

const item = (id: string) => ({
	id,
	name: id,
	description: null,
	total_downloads: 1,
	verified: false,
	type: 'display',
	last_updated: '2026-10-01T00:00:00.000Z',
	host_version: '^11.0.0',
	sandbox: false,
	license: null,
	publisher: { username: 'jane', verified: true, github_name: 'Jane Doe' },
});

async function mountRoute(account: unknown = ACCOUNT, count = 13) {
	const fetch = mockApi({
		'GET /extensions': [],
		'GET /extensions/registry/account/acc-1': account,
		'GET /extensions/registry': () => json({ meta: { filter_count: count }, data: [item('one'), item('two')] }),
	});

	const { wrapper } = await mountLayout(AccountRoute, {
		path: '/settings/marketplace/account/acc-1',
		routes: MARKETPLACE_TEST_ROUTES,
		props: { accountId: 'acc-1' },
	});

	await vi.waitFor(() => expect(calls(fetch).some((c) => c.startsWith('GET /extensions/registry?'))).toBe(true));
	await vi.waitFor(() => expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false));
	await flushPromises();

	return { wrapper, fetch };
}

test('banner, metadata links and the account extensions', async () => {
	const { wrapper, fetch } = await mountRoute();

	expect(calls(fetch)).toEqual(
		expect.arrayContaining([
			'GET /extensions/registry/account/acc-1',
			'GET /extensions/registry?limit=6&offset=0&filter[by][_eq]=acc-1',
		]),
	);
	assertOnlyKnownRequests(calls(fetch));

	const banner = wrapper.get('h2');
	expect(banner.text()).toContain('Jane Doe');
	expect(banner.text()).toContain('Verified');
	expect(wrapper.get('main img').attributes('alt')).toBe('Jane Doe');
	expect(wrapper.text()).toContain('Hanoi');
	expect(wrapper.text()).toContain('Acme');
	expect(wrapper.text()).toContain('Builds extensions');

	const links = wrapper.findAll('a[target="_blank"]').map((a) => [a.attributes('href'), a.attributes('rel')]);
	expect(links).toEqual([
		['https://npmjs.org/~jane', 'noopener noreferrer'],
		['https://github.com/janedoe', 'noopener noreferrer'],
		['https://jane.test', 'noopener noreferrer'],
	]);

	expect(wrapper.findAll('li a').map((a) => a.attributes('href'))).toEqual([
		'/settings/marketplace/extension/one',
		'/settings/marketplace/extension/two',
	]);
	// no type filter on this list: the type chip shows only when asked (DR passes no show-type here)
	expect(wrapper.get('li a').text()).not.toContain('Display');
});

test('pages: Math.round(13 / 6) = 2 pages; page 2 asks offset 6', async () => {
	const { wrapper, fetch } = await mountRoute();

	const nav = wrapper.get('nav[aria-label="Marketplace"]');
	expect(nav.findAll('button').map((b) => b.text())).toEqual(['arrow_back', '1', '2', 'arrow_forward']);

	await nav
		.findAll('button')
		.find((b) => b.text() === '2')!
		.trigger('click');
	await vi.waitFor(() =>
		expect(calls(fetch)).toContain('GET /extensions/registry?limit=6&offset=6&filter[by][_eq]=acc-1'),
	);
});

test('unknown account: the API error and a link back to the registry', async () => {
	const { wrapper } = await mountRoute(() =>
		json({ errors: [{ message: 'Account not found', extensions: { code: 'NOT_FOUND' } }] }, 404),
	);

	expect(wrapper.text()).toContain('Account not found');
	expect(wrapper.findAll('a[href="/settings/marketplace"]').at(-1)!.text()).toContain('Marketplace');
});
