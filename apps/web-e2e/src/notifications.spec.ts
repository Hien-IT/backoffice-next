// Feature 018 US6, US7 (T096, T101; US6-1 to US6-6, US7-1 to US7-3, FR-070 to FR-082): the header bell and the
// notifications drawer for a temporary user with three notifications made in beforeAll (an item, a singleton and one
// without a target; the admin's fixture notifications are never touched): the badge count, Inbox and Archive, Archive /
// Unarchive moving a row and the badge, search, opening each kind of target, Delete after confirming, the Activity
// link. Then the in-place notice after a dashboard import (role="status", gone after 3 s) and the error dialog when
// Save of a dashboard fails (Dismiss focused, no "Report error").
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { createTempDashboard, deleteTempDashboards, openInsights, tempDashboardName } from './helpers/insights.js';
import { login, resetLastPage } from './helpers/login.js';
import { openSidebar } from './helpers/content.js';
import { notificationsBell, openNotificationsDrawer } from './helpers/layout.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
let fixtures: Fixtures;
let user: TestUser;
let itemId: number;

const SUBJECTS = {
	item: `${DATA_PREFIX} notification item`,
	singleton: `${DATA_PREFIX} notification singleton`,
	plain: `${DATA_PREFIX} notification plain`,
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	const role = await fixtures.role('notifications', { read: ['bo_content', 'bo_singleton'] });
	// The minimal app permissions read and update one's own notifications but do not delete them (Directus): without
	// this the Delete of the drawer answers FORBIDDEN and opens the error dialog.
	const [access] = await api.call<{ policy: string }[]>('GET', `/access?filter[role][_eq]=${role}&fields=policy`);
	await api.call('POST', '/permissions', {
		data: {
			policy: access!.policy,
			collection: 'directus_notifications',
			action: 'delete',
			fields: ['*'],
			permissions: { recipient: { _eq: '$CURRENT_USER' } },
			validation: {},
		},
	});
	user = await fixtures.user('notifications', { role });
	const [first] = await api.call<{ id: number }[]>('GET', '/items/bo_content?fields=id&sort=id&limit=1');
	itemId = first!.id;

	await api.call('POST', '/notifications', {
		data: [
			{
				recipient: user.id,
				subject: SUBJECTS.item,
				message: 'See **this** item.',
				collection: 'bo_content',
				item: String(itemId),
			},
			{ recipient: user.id, subject: SUBJECTS.singleton, collection: 'bo_singleton' },
			{ recipient: user.id, subject: SUBJECTS.plain, message: 'No target.' },
		],
	});
	await deleteTempDashboards(api, 'notices');
});

test.afterAll(async () => {
	await deleteTempDashboards(api, 'notices');
	// The user's notifications go with the user (recipient is cascade deleted, as in Directus).
	await fixtures.cleanup();
});

async function signIn(page: Page, who: { email: string; password: string } = user) {
	await page.goto('/admin/login');
	await login(page, who);
	await expect(page).toHaveURL(CONTENT_URL);
}

// The drawer is modal: while it is open the header is aria-hidden, so the bell is found by its label attribute.
const bell = notificationsBell;
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Notifications', exact: true });
const row = (page: Page, subject: string) =>
	drawer(page).locator('li, [role="listitem"], .notification').filter({ hasText: subject }).first();

async function openDrawer(page: Page) {
	await openNotificationsDrawer(page);
}

async function select(page: Page, subject: string) {
	await drawer(page)
		.getByRole('checkbox', { name: `Select ${subject}` })
		.click();
}

test('the badge, Inbox and Archive, Archive / Unarchive (US6-1 to US6-4)', async ({ page }) => {
	await signIn(page);
	await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications, 3 unread');

	await openDrawer(page);
	for (const subject of Object.values(SUBJECTS)) await expect(drawer(page)).toContainText(subject);

	await select(page, SUBJECTS.plain);
	await drawer(page).getByRole('button', { name: 'Archive', exact: true }).click();
	await expect(drawer(page)).not.toContainText(SUBJECTS.plain);
	await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications, 2 unread');

	await drawer(page).getByRole('tab', { name: 'Archive' }).click();
	await expect(drawer(page)).toContainText(SUBJECTS.plain);
	await select(page, SUBJECTS.plain);
	await drawer(page).getByRole('button', { name: 'Unarchive', exact: true }).click();
	await expect(drawer(page)).not.toContainText(SUBJECTS.plain);
	await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications, 3 unread');
});

test('search, the message, opening an item and a singleton (US6-3, US6-5, US6-6)', async ({ page }) => {
	await signIn(page);
	await openDrawer(page);

	await drawer(page)
		.getByRole('searchbox')
		.or(drawer(page).getByPlaceholder(/Search/))
		.first()
		.fill('singleton');
	await expect(drawer(page)).toContainText(SUBJECTS.singleton);
	await expect(drawer(page)).not.toContainText(SUBJECTS.item);
	await drawer(page)
		.getByRole('searchbox')
		.or(drawer(page).getByPlaceholder(/Search/))
		.first()
		.fill('zzz-no-match');
	await expect(drawer(page)).toContainText('No Results');
	await drawer(page).getByRole('button', { name: 'Clear Filters' }).click();
	await expect(drawer(page)).toContainText(SUBJECTS.item);

	await row(page, SUBJECTS.item).getByRole('button', { name: 'Expand' }).click();
	await expect(row(page, SUBJECTS.item).locator('strong')).toHaveText('this');

	await row(page, SUBJECTS.item).getByRole('button', { name: 'View Content' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/content/bo_content/${itemId}$`));
	await expect(drawer(page)).toBeHidden();

	await openDrawer(page);
	await row(page, SUBJECTS.singleton).getByRole('button', { name: 'View Content' }).click();
	await expect(page).toHaveURL(/\/admin\/content\/bo_singleton$/);

	await openDrawer(page);
	await expect(row(page, SUBJECTS.plain).getByRole('button', { name: 'View Content' })).toHaveCount(0);
});

test('Delete after confirming; the Activity link (US6-4, FR-075)', async ({ page }) => {
	await signIn(page);
	await openDrawer(page);

	await select(page, SUBJECTS.plain);
	await drawer(page).getByRole('button', { name: 'Delete', exact: true }).click();
	const confirm = page.getByRole('dialog').filter({ hasText: /This action is permanent/ });
	await confirm.getByRole('button', { name: 'Delete' }).click();
	await expect(confirm).toBeHidden();
	await expect(page.locator('[data-notifications-drawer]')).not.toContainText(SUBJECTS.plain);
	await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications, 2 unread');

	await drawer(page).getByRole('link', { name: 'Activity' }).click();
	await expect(page).toHaveURL(/\/admin\/activity$/);
});

test('in-place notice after a dashboard import, gone after 3 s (US7-1, FR-080)', async ({ page }) => {
	await resetLastPage(api);
	await openInsights(page);
	await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
	await openSidebar(page);
	if ((await page.locator('[data-import-file]').count()) === 0)
		await page.getByRole('button', { name: 'Import', exact: true }).click();
	const name = tempDashboardName('notices', 'import');
	await page.locator('[data-import-file]').setInputFiles({
		name: 'dashboards.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify([{ name, icon: 'dashboard' }])),
	});
	await page.getByRole('button', { name: 'Start Import' }).click();
	// Below xl the sidebar is a modal drawer that hides the page (and its notices) from the accessibility tree.
	const close = page.getByRole('button', { name: 'Close sidebar', exact: true });
	if (await close.isVisible()) await close.click();

	const notice = page.getByRole('status').filter({ hasText: 'Data successfully imported from dashboards.json' }).last();
	await expect(notice).toBeVisible();
	await expect(notice).toBeHidden({ timeout: 6000 });
});

test('a failing Save opens the error dialog with Dismiss focused (US7-2, FR-081, D-109)', async ({ page }) => {
	await resetLastPage(api);
	const id = await createTempDashboard(api, tempDashboardName('notices', 'save'), [
		{ type: 'label', position_x: 1, position_y: 1, width: 6, height: 2, options: { text: 'x' } },
	]);
	await openInsights(page, `/${id}`);
	await page.route(/\/panels(\?|$)/, (route) =>
		['POST', 'PATCH', 'DELETE'].includes(route.request().method())
			? route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ errors: [{ message: 'Boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }),
				})
			: route.continue(),
	);

	await page.getByRole('button', { name: 'Edit Panels' }).click();
	await page
		.locator('[data-panel-type="label"]')
		.getByRole('button', { name: /^Options for/ })
		.click();
	await page.getByRole('menuitem', { name: 'Duplicate' }).click();
	await page.getByRole('button', { name: 'Save' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('[INTERNAL_SERVER_ERROR] Boom');
	await expect(dialog.getByRole('button', { name: 'Dismiss' })).toBeFocused();
	await expect(dialog.getByRole('button', { name: /report/i })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Dismiss' }).click();
	await expect(dialog).toBeHidden();
});
