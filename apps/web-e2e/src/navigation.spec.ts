// US2 (T046, contracts/e2e.md §2): module bar from settings and permissions, module URLs and titles, layout state,
// last_page, private 404, API errors. The module order is compared with the Directus app 11.17.4 on the same database.
import type { Browser, Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, directusUrl } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const MODULE_PATHS = /^\/admin\/(content|users|files|insights|settings|activity|visual|deployments)$/;
const DOCS = 'https://docs.directus.io';

let api: AdminApi;
let fixtures: Fixtures;
let filesOnly: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	filesOnly = await fixtures.user('files-only', {
		role: await fixtures.role('files only', { read: ['directus_files'] }),
	});
	// The Directus column defaults, shown as Backoffice (D-51).
	await api.patchSettings({ module_bar: null, project_name: 'Directus', project_color: '#6644FF' });
});

test.beforeEach(async () => {
	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	await api.patchSettings({ module_bar: null });
	await fixtures.cleanup();
	await closeHostDb();
});

async function signIn(page: Page, user: { email: string; password: string } = ADMIN) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(CONTENT_URL);
}

/** hrefs of the module bar of the Backoffice app, in order. */
async function moduleBarHrefs(page: Page): Promise<string[]> {
	// Feature 014: the Content sub-menu (collection tree) sits inside the module bar; its links are not modules.
	return (await moduleBar(page))
		.locator('a')
		.evaluateAll((links) => links.filter((a) => !a.closest('[role="tree"]')).map((a) => a.getAttribute('href') ?? ''));
}

/** hrefs of the module bar of the Directus app, read in its own browser context. */
async function directusModuleBar(
	browser: Browser,
	user: { email: string; password: string } = ADMIN,
): Promise<string[]> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${directusUrl}/admin/login`);
	await page.locator('input[type="email"]').fill(user.email);
	await page.locator('input[type="password"]').fill(user.password);
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/\/admin\/content/, { timeout: 30_000 });
	const hrefs = await page
		.locator('.module-bar a')
		.evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
	await context.close();
	return hrefs;
}

const modulesOnly = (hrefs: string[]) => hrefs.filter((href) => MODULE_PATHS.test(href));

test('admin, default module bar: order of Directus without Documentation, URLs and titles (US2-1, D-49)', async ({
	page,
	browser,
}) => {
	await signIn(page);

	const hrefs = await moduleBarHrefs(page);
	expect(modulesOnly(hrefs)).toEqual([
		'/admin/content',
		'/admin/users',
		'/admin/files',
		'/admin/insights',
		'/admin/settings',
	]);
	expect(hrefs).not.toContain(DOCS);

	const directus = await directusModuleBar(browser);
	expect(directus).toContain(DOCS);
	expect(modulesOnly(hrefs)).toEqual(modulesOnly(directus));

	for (const [path, title] of [
		// Feature 015: the users module opens the active users list, titled like Directus.
		['/admin/users', 'Active Users'],
		['/admin/files', 'File Library'],
		['/admin/insights', 'Insights'],
		['/admin/content', 'Content'],
	] as const) {
		await (await moduleBar(page)).locator(`a[href="${path}"]`).click();
		// Feature 014: /admin/content sends to a collection (its name is the title), like the Directus app.
		if (path === '/admin/content') {
			await expect(page).toHaveURL(CONTENT_URL);
			await expect(page).toHaveTitle(/ · Backoffice$/);
		} else {
			await expect(page).toHaveURL(new RegExp(`${path}$`));
			await expect(page).toHaveTitle(`${title} · Backoffice`);
		}
		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
	}

	await (await moduleBar(page)).locator('a[href="/admin/settings"]').click();
	await expect(page).toHaveURL(/\/admin\/settings\/data-model$/);
	// Feature 016: the real data model page (its title, like the Directus app) replaces the 012 frame.
	await expect(page).toHaveTitle('Data Model · Backoffice');
});

test('custom module_bar: order, enabled, internal and external links; the default docs link stays hidden (US2-2, FR-081)', async ({
	page,
	browser,
}) => {
	await api.patchSettings({
		module_bar: [
			{ type: 'module', id: 'files', enabled: true },
			{ type: 'link', id: 'activity-link', name: 'Activity', icon: 'notifications', url: '/activity', enabled: true },
			{ type: 'module', id: 'content', enabled: true },
			{ type: 'module', id: 'users', enabled: false },
			{ type: 'link', id: 'docs', name: '$t:documentation', icon: 'help', url: DOCS, enabled: true },
			{ type: 'link', id: 'site', name: 'Site', icon: 'link', url: 'https://example.com/', enabled: true },
			{ type: 'module', id: 'settings', enabled: true, locked: true },
		],
	});

	await signIn(page);
	const hrefs = await moduleBarHrefs(page);
	expect(hrefs.filter((h) => h.startsWith('/admin/') || h.startsWith('http'))).toEqual([
		'/admin/files',
		'/admin/activity',
		'/admin/content',
		'https://example.com/',
		'/admin/settings',
	]);
	await expect(page.getByTestId('module-bar').locator('a[href="https://example.com/"]')).toHaveAttribute(
		'target',
		'_blank',
	);

	expect(await directusModuleBar(browser)).toContain(DOCS);
	await api.patchSettings({ module_bar: null });
});

test('a user who only reads directus_files: same modules as the Directus app, no Insights or Settings; /insights is a 404, /activity opens (US2-3)', async ({
	page,
	browser,
}) => {
	await signIn(page, filesOnly);

	const hrefs = modulesOnly(await moduleBarHrefs(page));
	expect(hrefs).toEqual(modulesOnly(await directusModuleBar(browser, filesOnly)));
	expect(hrefs).toContain('/admin/files');
	expect(hrefs).not.toContain('/admin/insights');
	expect(hrefs).not.toContain('/admin/settings');

	await page.goto('/admin/insights');
	await expect(page.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeVisible();
	await moduleBar(page);

	await page.goto('/admin/activity');
	// Feature 018 replaced the module frame with the Activity Feed page (Directus title `activity_feed`).
	await expect(page).toHaveTitle('Activity Feed · Backoffice');
});

test('last_page is written after navigation and used on the next sign-in (US2-5, FR-018)', async ({ page }) => {
	await signIn(page);

	// trackPage runs 500 ms after each navigation, so the write of the landing page can still arrive after the click:
	// wait for the one of /files.
	const tracked = page.waitForResponse(
		(r) =>
			r.request().method() === 'PATCH' &&
			r.url().includes('/users/me/track/page') &&
			r.request().postDataJSON()?.last_page === '/files',
	);
	await (await moduleBar(page)).locator('a[href="/admin/files"]').click();
	expect((await tracked).request().postDataJSON()).toEqual({ last_page: '/files' });

	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/\/admin\/login/);
	// The parity APIs run with CACHE_ENABLED: drop the cached /users/me so the new last_page is read.
	await api.call('POST', '/utils/cache/clear');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/files$/);
});

test('an unknown path shows the private 404 inside the layout (US2-6)', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/khong-co');

	await expect(page.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeVisible();
	await moduleBar(page);
});

test('/server/info failing shows the error screen; without project the defaults show (US2-7, FR-003, FR-037)', async ({
	page,
}) => {
	await page.route('**/server/info', (route) => route.abort());
	await page.goto('/admin/');
	await expect(page.getByText('Unexpected Error')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reload Page' })).toBeVisible();

	await page.unroute('**/server/info');
	await page.route('**/server/info', (route) => route.fulfill({ json: { data: { setupCompleted: true } } }));
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
	await expect(page.getByText('Backoffice').first()).toBeVisible();
});

test('collapsed navigation stays collapsed after reload, the detail popover is closed again; below lg the navigation is a keyboard drawer (US2-4, FR-027, FR-028, D-128)', async ({
	page,
}) => {
	await signIn(page);
	const width = page.viewportSize()!.width;

	if (width >= 1280) {
		// TailAdmin: the collapsed sidebar stays as a 90 px rail; the toggle reports the state.
		const toggle = page.getByRole('button', { name: 'Toggle Navigation' });
		// The detail panel is a popover closed on every page load (D-128): opened here, closed after the reload.
		await page.getByRole('button', { name: 'Open sidebar' }).click();
		await page.keyboard.press('Escape');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');

		await page.reload();
		await expect(page.getByRole('button', { name: 'Open sidebar' })).toHaveAttribute('aria-expanded', 'false');
		await expect(page.getByRole('button', { name: 'Toggle Navigation' })).toHaveAttribute('aria-expanded', 'false');
		const rail = await page.getByRole('complementary', { name: 'Navigation' }).boundingBox();
		expect(rail!.width).toBeLessThanOrEqual(90);

		await page.evaluate(() => localStorage.clear());
		return;
	}

	// Below xl (768 px): the navigation drawer opens and closes with the keyboard, focus comes back to the button.
	const open = page.getByRole('button', { name: 'Open navigation' });
	await open.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('module-bar')).toBeVisible();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('module-bar')).toBeHidden();
	await expect(open).toBeFocused();

	// No horizontal scroll at the smallest supported width (FR-028, SC-008).
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
