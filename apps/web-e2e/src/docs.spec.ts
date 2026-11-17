// Spec 033 (D-215, FR-012..FR-014, FR-041, FR-043, FR-048a, FR-049, FR-054, SC-001, SC-002, SC-007; contracts/tests.md
// §3): the documentation area, /admin/docs. It is content of the app itself, so it opens the same in the three
// configurations (also when the API is Directus): from the user menu, through its menu in the sidebar, by a link with an
// anchor, and after a sign-in for someone who was not signed in. The admin's language is English here, so the frame and
// the content are English; one case switches the admin to vi-VN for the Vietnamese content (amendment 2026-11-18).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, e2eConfig } from './helpers/config.js';
import { moduleNavigation } from './helpers/layout.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

// The admin's last page would otherwise be a documentation page for the specs that run after this one.
test.afterAll(async () => {
	await resetLastPage(api);
});

async function signIn(page: Page) {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

const title = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 });
const wide = (page: Page) => page.viewportSize()!.width >= 1280;

/** A page link of the documentation menu (below `xl` the sidebar is a drawer, opened first). */
async function menuLink(page: Page, name: string) {
	await moduleNavigation(page);
	return page.getByRole('navigation', { name: 'Documentation', exact: true }).getByRole('link', { name, exact: true });
}

test('opens from the user menu in two clicks; the menu in the sidebar changes the page (SC-001)', async ({ page }) => {
	await signIn(page);

	// Below `xl` the sidebar is a drawer to open first; the two clicks are the avatar and the menu item.
	await moduleNavigation(page);
	await page.locator('aside#navigation button[aria-haspopup="menu"]').last().click();
	await page.getByRole('menuitem', { name: 'Documentation' }).click();

	await expect(page).toHaveURL(/\/admin\/docs$/);
	await expect(title(page)).toHaveText('Getting Started');
	await expect(page.locator('.docs-article[lang="en"] h2').first()).toBeVisible();

	await (await menuLink(page, 'General')).click();
	await expect(page).toHaveURL(/\/admin\/docs\/configuration\/general$/);
	await expect(title(page)).toHaveText('General');
	await expect(await menuLink(page, 'General')).toHaveAttribute('aria-current', 'page');

	await (await menuLink(page, 'Database')).click();
	await expect(page).toHaveURL(/\/admin\/docs\/configuration\/database$/);
	await expect(page.locator('tr[data-variable="DB_*"]')).toBeVisible();

	// The previous page of the pager, in menu order.
	await page.locator('[data-docs-previous]').click();
	await expect(page).toHaveURL(/\/admin\/docs\/configuration\/general$/);
});

test('an admin whose language is vi-VN reads the Vietnamese content (amendment 2026-11-18)', async ({ page }) => {
	await api.call('PATCH', '/users/me', { data: { language: 'vi-VN' } });
	try {
		await signIn(page);
		await page.goto('/admin/docs/configuration/general#may-chu-http');

		await expect(title(page)).toHaveText('Chung');
		await expect(page.locator('#may-chu-http')).toHaveText(/Máy chủ HTTP/);
		await expect(page.locator('[data-docs-lead]')).toHaveAttribute('lang', 'vi');
	} finally {
		await api.call('PATCH', '/users/me', { data: { language: null } });
	}
});

test('a link with an anchor opens at that heading (FR-007)', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/docs/configuration/general#first-admin-account');

	const heading = page.locator('#first-admin-account');
	await expect(heading).toHaveText(/First Admin Account/);
	await expect(heading).toBeInViewport();
	await expect(heading).toBeFocused();

	// An anchor that does not exist leaves the page at its top, without an error. (From another page: a URL that only
	// differs by its hash is not a new load.)
	await page.goto('/admin/docs');
	await expect(title(page)).toHaveText('Getting Started');
	await page.goto('/admin/docs/configuration/general#khong-co');
	await expect(title(page)).toHaveText('General');
	await expect(page.locator('tr[data-variable="CONFIG_PATH"]')).toBeInViewport();
});

test('not signed in: the sign-in leads back to the page and the anchor (FR-013)', async ({ page }) => {
	await resetLastPage(api);
	await page.goto('/admin/docs/configuration/general#http-server');
	await expect(page).toHaveURL(/\/admin\/login\?redirect=/);

	await login(page, ADMIN);

	await expect(page).toHaveURL(/\/admin\/docs\/configuration\/general#http-server$/);
	const heading = page.locator('#http-server');
	await expect(heading).toHaveText(/HTTP Server/);
	await expect(heading).toBeInViewport();
});

test('narrow screen: the menu is in the drawer, no "On this page" column, no sideways scroll (FR-041)', async ({ page }) => {
	test.skip(wide(page), 'the 768 px project');
	await signIn(page);
	await page.goto('/admin/docs/configuration/auth');
	await expect(title(page)).toHaveText('Authentication and SSO');

	await expect(page.locator('[data-docs-toc]')).toBeHidden();
	await expect(page.locator('aside#navigation')).toBeHidden();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

	await (await menuLink(page, 'General')).click();
	await expect(page).toHaveURL(/\/admin\/docs\/configuration\/general$/);
});

test.describe('proxy-api', () => {
	test.skip(e2eConfig !== 'proxy-api', 'one configuration is enough for the content checks');

	test('the General page lists PUBLIC_URL with the default of the API; reached in at most 4 clicks (SC-002)', async ({
		page,
	}) => {
		test.skip(!wide(page), 'the click count is for the inline sidebar');
		await signIn(page);
		await page.goto('/admin/docs');
		await expect(title(page)).toHaveText('Getting Started');

		// Click 1: the page in the menu. Click 2: its section in "On this page".
		await (await menuLink(page, 'General')).click();
		await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'General', exact: true }).click();

		const row = page.locator('tr[data-variable="PUBLIC_URL"]');
		await expect(row).toBeInViewport();
		await expect(row.locator('td').nth(2)).toHaveText('/');
	});

	test('API: the Files page has List Files with its examples; reached in at most 4 clicks (SC-002)', async ({ page }) => {
		test.skip(!wide(page), 'the click count is for the inline sidebar');
		await signIn(page);
		await page.goto('/admin/docs');
		await expect(title(page)).toHaveText('Getting Started');

		// Click 1: the resource in the menu. Click 2: the endpoint in "On this page".
		await (await menuLink(page, 'Files')).click();
		await expect(title(page)).toHaveText('Files');
		await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'List Files', exact: true }).click();

		const card = page.locator('section[data-operation="getFiles"]');
		await expect(card.locator('#list-files')).toBeInViewport();
		await expect(card.locator('[data-method]')).toHaveText('GET');
		await expect(card.locator('[data-path]')).toHaveText('/files');
		await expect(card.getByRole('tab', { name: 'GraphQL' })).toBeVisible();
		await card.getByRole('tab', { name: 'GraphQL' }).click();
		await expect(card.getByRole('tabpanel')).toContainText('files(limit: 2)');
	});

	test('API: the Backoffice routes page says who may call each endpoint (FR-027)', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/docs/api/backoffice');

		await expect(title(page)).toHaveText('Backoffice');
		await expect(page.locator('[data-docs-backoffice-only]')).toBeVisible();
		await expect(page.locator('section[data-operation="createIndex"] [data-access]')).toHaveText(
			'Available only when the server is Backoffice. Admin only.',
		);
		await expect(page.locator('section[data-operation="getPasskeyRp"] [data-access]')).toContainText('No sign-in needed');
	});

	test('the Files guide: steps, screenshots loaded, a link to the API, no CSP violation (FR-018, FR-034)', async ({
		page,
	}) => {
		const csp: string[] = [];
		page.on('console', (message) => {
			if (/Content Security Policy/i.test(message.text())) csp.push(message.text());
		});

		await signIn(page);
		await page.goto('/admin/docs');
		await expect(title(page)).toHaveText('Getting Started');
		await (await menuLink(page, 'File Library')).click();
		await expect(page).toHaveURL(/\/admin\/docs\/guides\/files$/);
		await expect(title(page)).toHaveText('File Library');

		const article = page.locator('.docs-article');
		await expect(article.locator('ol > li').first()).toBeVisible();
		const images = article.locator('img.docs-image');
		await expect(images).toHaveCount(2);
		for (const image of await images.all()) {
			await image.scrollIntoViewIfNeeded();
			await expect(image).toHaveAttribute('alt', /.{20,}/);
			await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
		}

		await article.getByRole('link', { name: 'upload a file', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/docs\/api\/files#create-a-file$/);
		await expect(page.locator('#create-a-file')).toBeInViewport();
		expect(csp).toEqual([]);
	});

	test('an unknown documentation page: not found in the frame, with a link home (FR-009)', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/docs/khong/co/trang-nay');

		await expect(title(page)).toHaveText('Page Not Found');
		await page.getByRole('main').getByRole('link', { name: 'Back to the documentation home' }).click();
		await expect(page).toHaveURL(/\/admin\/docs$/);
		await expect(title(page)).toHaveText('Getting Started');
	});

	test('the first documentation page shows within 2 seconds of the click, without a CSP violation and without a new API call (SC-007, FR-048a)', async ({
		page,
		apiRequests,
		browserName,
	}) => {
		test.skip(!wide(page) || browserName !== 'chromium', 'timed on chromium, wide layout');
		const csp: string[] = [];
		page.on('console', (message) => {
			if (/Content Security Policy/i.test(message.text())) csp.push(message.text());
		});

		await signIn(page);
		await page.locator('aside#navigation button[aria-haspopup="menu"]').last().click();
		const item = page.getByRole('menuitem', { name: 'Documentation' });
		await expect(item).toBeVisible();
		const before = apiRequests.length;

		const started = Date.now();
		await item.click();
		await expect(page.locator('.docs-article h2').first()).toBeVisible();
		expect(Date.now() - started).toBeLessThan(2000);

		// A page with the tables and their code spans, then back: still no violation.
		await (await menuLink(page, 'Security and Limits')).click();
		await expect(page.locator('tr[data-variable="SECRET"]')).toBeVisible();
		expect(csp).toEqual([]);

		// The documentation is static: the only API call a page change adds is the last-page write of every private page.
		await page.waitForTimeout(800);
		const added = apiRequests.slice(before).map((request) => `${request.method} ${request.path}`);
		expect(added.filter((call) => call !== 'PATCH /users/me/track/page')).toEqual([]);
	});

	test('keyboard only: from the page to a documentation page and back to its top (FR-043)', async ({ page }) => {
		test.skip(!wide(page), 'below xl the menu sits in the drawer');
		await signIn(page);
		await page.goto('/admin/docs');
		await expect(title(page)).toHaveText('Getting Started');

		// The first page of the API part: the walk does not depend on how many resources the menu lists.
		const link = await menuLink(page, 'Access');
		await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

		for (let i = 0; i < 40 && !(await link.evaluate((el) => el === document.activeElement)); i++) {
			await page.keyboard.press('Tab');
		}

		await expect(link).toBeFocused();
		expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/admin\/docs\/api\/access$/);
		// The focus moves to the title of the new page.
		await expect(title(page)).toBeFocused();
	});
});
