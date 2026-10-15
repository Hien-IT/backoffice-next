// Feature 014 US1 (T028; US1-3 to US1-6, FR-022 to FR-034, FR-116, SC-003): the table layout on the fixture set bo_*.
// Preset writes are read back through AdminApi; the seeded admin preset of bo_content is restored after each test.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { clearAdminPresets, openCollection, waitForTable } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

type Preset = {
	id: number;
	layout: string | null;
	layout_query: any;
	layout_options: any;
	search: string | null;
	filter: any;
};

let api: AdminApi;
let me: string;
let seeded: Preset | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;
	seeded = (await adminPresets('bo_content'))[0];
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	// The parity APIs cache /users/me (CACHE_ENABLED): drop it so the sign-in reads the reset last_page.
	await api.call('POST', '/utils/cache/clear');
	await clearAdminPresets(api, 'bo_std');
});

test.afterEach(async ({ page }) => {
	// Close the page first: its preset auto-save (450 ms debounce) must not land after the restore below.
	await page.waitForTimeout(600);
	await page.close();
	await clearAdminPresets(api, 'bo_std');

	if (seeded) {
		const { layout, layout_query, layout_options, search, filter } = seeded;
		await api.call('PATCH', `/presets/${seeded.id}`, {
			data: { layout, layout_query, layout_options, search, filter },
		});
	}
});

async function adminPresets(collection: string): Promise<Preset[]> {
	// The parity APIs run with CACHE_ENABLED: read the rows, not a cached answer.
	await api.call('POST', '/utils/cache/clear');
	return api.call<Preset[]>(
		'GET',
		`/presets?filter[collection][_eq]=${collection}&filter[user][_eq]=${me}&filter[bookmark][_null]=true&limit=-1`,
	);
}

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

const listRequests = (page: Page, collection: string) => {
	const seen: string[] = [];
	page.on('request', (r) => {
		const url = new URL(r.url());
		if (r.method() === 'GET' && url.pathname.endsWith(`/items/${collection}`)) {
			seen.push(url.searchParams.has('aggregate') ? 'count' : 'list');
		}
	});
	return seen;
};

test(
	'columns and rows of the seeded preset; archived items hidden; one list request (US1-3, SC-003)',
	{ tag: '@core' },
	async ({ page }) => {
		await signIn(page);
		const requests = listRequests(page, 'bo_content');
		await openCollection(page, 'bo_content');
		const table = await waitForTable(page);

		await expect(table.getByRole('columnheader', { name: /Title/ })).toBeVisible();
		await expect(table.getByRole('columnheader', { name: /Status/ })).toBeVisible();
		await expect(table.getByRole('columnheader', { name: /Date Published/ })).toBeVisible();
		// 30 items, 10 archived (status `archived` is the archive value): 20 rows on one page of 25.
		await expect(table.locator('tbody tr')).toHaveCount(20);
		await expect(page.getByRole('status').filter({ hasText: /20 Items/ })).toBeAttached();
		expect(requests.filter((r) => r === 'list')).toHaveLength(1);

		await page.goto('/admin/content/bo_content?all');
		await expect((await waitForTable(page)).locator('tbody tr')).toHaveCount(25);
	},
);

test(
	'sort from the header menu writes the whole preset (US1-3, FR-011, FR-031)',
	{ tag: '@core' },
	async ({ page }) => {
		await signIn(page);
		await openCollection(page, 'bo_std');
		const table = await waitForTable(page);

		const header = table.getByRole('columnheader').nth(1);
		const written = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/presets'));
		await header.getByRole('button').first().click();
		await page.getByRole('menuitemradio', { name: 'Sort Descending' }).click();
		const body = (await written).postDataJSON();

		expect(body).toMatchObject({ collection: 'bo_std', user: me, bookmark: null, icon: 'bookmark' });
		expect(body.layout_query.tabular.sort[0]).toMatch(/^-/);
		await expect(header).toHaveAttribute('aria-sort', 'descending');

		await expect.poll(async () => (await adminPresets('bo_std'))[0]?.layout_query?.tabular?.sort?.[0]).toMatch(/^-/);
	},
);

test('page size and pages (FR-033)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/content/bo_content?all');
	const table = await waitForTable(page);

	// 30 items with ?all: two pages of 25 (Directus sizes 25, 50, 100, ...).
	const pages = page.getByRole('navigation', { name: 'Bo Content' });
	await pages.getByRole('button', { name: '2', exact: true }).click();
	await expect(table.locator('tbody tr')).toHaveCount(5);
	await expect(pages.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');

	// Like Directus, the size select shows only when the page is full (or the limit below 25).
	await expect(page.getByRole('combobox', { name: 'Per Page' })).toHaveCount(0);
	await pages.getByRole('button', { name: '1', exact: true }).click();
	await page.getByRole('combobox', { name: 'Per Page' }).click();
	await page.getByRole('option', { name: '50', exact: true }).click();
	await expect(table.locator('tbody tr')).toHaveCount(30);
	await expect(pages).toHaveCount(0);
});

test(
	'row click opens the item; Ctrl/Cmd+click a new tab; selection (FR-034)',
	{ tag: '@core' },
	async ({ page, context }) => {
		await signIn(page);
		await openCollection(page, 'bo_content');
		const table = await waitForTable(page);

		const opened = context.waitForEvent('page');
		await table
			.locator('tbody tr')
			.nth(2)
			.getByRole('cell')
			.nth(2)
			.click({ modifiers: ['ControlOrMeta'] });
		const tab = await opened;
		await expect(tab).toHaveURL(/\/admin\/content\/bo_content\/\d+$/);
		await tab.close();

		// With a selection, a row click selects (Directus useLayoutClickHandler); without, it opens the item.
		const boxes = table.getByRole('checkbox', { name: 'Select Item' });
		await boxes.nth(0).check();
		await boxes.nth(1).check();
		await expect(boxes.nth(1)).toBeChecked();

		await table.locator('tbody tr').nth(2).getByRole('cell').nth(2).click();
		await expect(boxes.nth(2)).toBeChecked();
		await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);

		await boxes.nth(0).uncheck();
		await boxes.nth(1).uncheck();
		await boxes.nth(2).uncheck();
		await table.locator('tbody tr').nth(2).getByRole('cell').nth(2).click();
		await expect(page).toHaveURL(/\/admin\/content\/bo_content\/\d+$/);
	},
);

test('an API error shows the error state and the reset button (FR-028)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await page.route(/\/items\/bo_std\?(?!.*aggregate)/, (route) =>
		route.fulfill({ status: 500, json: { errors: [{ message: 'x', extensions: { code: 'INTERNAL' } }] } }),
	);
	await openCollection(page, 'bo_std');

	await expect(page.getByRole('heading', { name: 'Unexpected Error' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reset Page Preferences' })).toBeVisible();
});

test('768 px: no horizontal page scroll (FR-116)', { tag: '@core' }, async ({ page }, testInfo) => {
	test.skip(!testInfo.project.name.endsWith('-768'), 'narrow viewport only');
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);

	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
