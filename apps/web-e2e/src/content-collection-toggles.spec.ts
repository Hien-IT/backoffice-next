// Spec 022 (US1, US2, D-179): the per-collection toggles bo_show_search, bo_show_import, bo_show_export of
// directus_collections on the Content page of bo_content, for the admin and a user reading bo_content (FR-006); the
// Data Model form shows them with their labels in a card titled by the web app (FR-002, D-182); the API still searches
// and exports (FR-008). The columns come from the Backoffice migration 20261026A that the API pair ran at start; behind
// proxy-directus Directus returns them too.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN } from './helpers/config.js';
import { e2eName, openCollection, openSidebar, waitForTable } from './helpers/content.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

// The values every collection has (the column default); null also means shown (FR-007, unit tests and the bookmark case).
const TOGGLES = { bo_show_search: true, bo_show_import: true, bo_show_export: true };

let api: AdminApi;
let fixtures: Fixtures;
let reader: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	reader = await fixtures.user('toggles-reader', {
		role: await fixtures.role('toggles reader', { read: ['bo_content'] }),
	});
});

test.afterAll(async () => {
	await api.call('PATCH', '/collections/bo_content', { data: { meta: TOGGLES } });
	await fixtures.cleanup();
});

test.afterEach(async () => {
	await api.call('PATCH', '/collections/bo_content', { data: { meta: TOGGLES } });
	await api.call('POST', '/utils/cache/clear');
});

async function toggle(meta: Partial<Record<keyof typeof TOGGLES, boolean | null>>) {
	await api.call('PATCH', '/collections/bo_content', { data: { meta } });
	await api.call('POST', '/utils/cache/clear');
}

async function signIn(page: Page, user: { email: string; password: string } = ADMIN) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

async function openImportExport(page: Page) {
	await openSidebar(page);
	await page.getByRole('button', { name: /^Import \/ Export/ }).click();
}

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search Items...' });
const filterButton = (page: Page) => page.getByRole('button', { name: 'Filter', exact: true });

for (const who of ['admin', 'reader'] as const) {
	test(`${who}: bo_show_search false hides the keyword box, the filter stays and filters (US1-1, US1-2, FR-003)`, async ({
		page,
	}) => {
		await toggle({ bo_show_search: false });
		await signIn(page, who === 'admin' ? ADMIN : reader);
		await openCollection(page, 'bo_content');
		// The reader has no preset of its own: the global preset of the fixture set opens the cards layout, not a table.
		await expect(filterButton(page)).toBeVisible();

		await expect(searchBox(page)).toHaveCount(0);
		await filterButton(page).click();
		await expect(page.getByRole('dialog').or(page.locator('[data-reka-popper-content-wrapper]')).first()).toBeVisible();
	});
}

test('the filter button is reached and opened with the keyboard (SC-004)', async ({ page }) => {
	await toggle({ bo_show_search: false });
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);

	await filterButton(page).focus();
	await expect(filterButton(page)).toBeFocused();
	await page.keyboard.press('Enter');
	const popover = page.locator('[data-reka-popper-content-wrapper]').first();
	await expect(popover).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(popover).toBeHidden();
});

test('a bookmark with a keyword: not sent while the box is hidden, kept in the bookmark (US1-3, FR-004)', async ({
	page,
	apiRequests,
}) => {
	const me = (await api.call<{ id: string }>('GET', '/users/me')).id;
	const bookmark = await api.call<{ id: number }>('POST', '/presets', {
		data: { collection: 'bo_content', user: me, bookmark: e2eName('toggles'), layout: 'tabular', search: 'Content 02' },
	});

	try {
		await toggle({ bo_show_search: false });
		await signIn(page);
		await page.goto(`/admin/content/bo_content?bookmark=${bookmark.id}`);
		await waitForTable(page);

		const reads = apiRequests.filter((r) => r.method === 'GET' && r.path === '/items/bo_content');
		expect(reads.length).toBeGreaterThan(0);
		expect(reads.every((r) => !new URL(r.url).searchParams.has('search'))).toBe(true);
		expect((await api.call<{ search: string }>('GET', `/presets/${bookmark.id}`)).search).toBe('Content 02');

		// Shown again: the bookmark keyword applies as before (US1-4).
		await toggle({ bo_show_search: null });
		await page.reload();
		await waitForTable(page);
		await expect(searchBox(page)).toHaveValue('Content 02');
	} finally {
		await api.call('DELETE', `/presets/${bookmark.id}`);
	}
});

test('bo_show_import false: the Import / Export section has export only (US2-1, FR-005)', async ({ page }) => {
	await toggle({ bo_show_import: false });
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await openImportExport(page);

	await expect(page.getByRole('button', { name: 'Export Items' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Download Page as CSV' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Start Import' })).toHaveCount(0);
});

test('bo_show_export false: import only, no export button and no CSV link (US2-2, FR-005)', async ({ page }) => {
	await toggle({ bo_show_export: false });
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await openImportExport(page);

	await expect(page.getByRole('button', { name: 'Start Import' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Export Items' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Download Page as CSV' })).toHaveCount(0);
});

test('both false: no Import / Export section; the API still searches and exports (US2-3, US2-4, FR-008)', async ({
	page,
}) => {
	await toggle({ bo_show_import: false, bo_show_export: false });
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await openSidebar(page);

	await expect(page.getByRole('button', { name: /^Import \/ Export/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Auto Refresh', exact: true })).toBeVisible();

	expect(await api.call<unknown[]>('GET', '/items/bo_content?search=Content&limit=1')).toHaveLength(1);
	// The export is a CSV file, not a JSON body: its raw bytes (bytes() throws on a status other than 2xx).
	expect((await api.bytes('/items/bo_content?export=csv&limit=1')).toString('utf8')).toContain('id');
});

test('the Data Model form has the three toggles; saving one is read back (FR-002, US4-4)', async ({
	page,
	apiRequests,
}) => {
	await signIn(page);
	await page.goto('/admin/settings/data-model/bo_content');

	const form = page.getByRole('main');
	await expect(form.getByRole('heading', { name: 'Content: Search, Import, Export', exact: true })).toBeVisible();
	for (const label of ['Show Search', 'Show Import', 'Show Export']) {
		await expect(form.getByText(label, { exact: true })).toBeVisible();
	}

	await form
		.getByRole('switch', { name: 'Show Export' })
		.or(form.getByRole('checkbox', { name: 'Show Export' }))
		.click();
	const patch = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/collections/bo_content'));
	await page.getByRole('button', { name: 'Save', exact: true }).first().click();
	expect((await patch).postDataJSON()).toMatchObject({ meta: { bo_show_export: false } });
	expect(apiRequests.some((r) => r.method === 'PATCH' && r.path === '/collections/bo_content')).toBe(true);
	await expect
		.poll(
			async () =>
				(await api.call<{ meta: { bo_show_export: boolean } }>('GET', '/collections/bo_content')).meta.bo_show_export,
		)
		.toBe(false);
});

test('the toggle labels and card title in vi-VN (FR-002, D-182)', async ({ page }) => {
	// Its own admin in vi-VN: the shared admin keeps its language for the other specs.
	const admin = await fixtures.user('toggles-vi', {
		role: await fixtures.role('toggles vi admin', { admin: true }),
		language: 'vi-VN',
	});
	await signIn(page, admin);
	await page.goto('/admin/settings/data-model/bo_content');

	await expect(
		page.getByRole('main').getByRole('heading', { name: 'Content: tìm kiếm, Import, Export' }),
	).toBeVisible();
	for (const label of ['Hiện ô tìm kiếm', 'Hiện Import', 'Hiện Export']) {
		await expect(page.getByRole('main').getByText(label, { exact: true })).toBeVisible();
	}
});
