// FR-067 (T065): WCAG 2.1 AA on the screens of the feature, light and dark, and the main flow by keyboard only.
// Color contrast of the token pairs listed in spec Q-8 is a known exception until the design owner answers; any other
// serious or critical violation, low contrast of other pairs included, fails.
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { openSidebar } from './helpers/content.js';
import { flowId, FLOWS, panel } from './helpers/flows.js';
import { dashboardId, DASHBOARDS } from './helpers/insights.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { openOwnPage } from './helpers/users.js';
import { openNotificationsPanel } from './helpers/layout.js';

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Q-8 (spec): token pairs measured below AA on 2026-10-14, a known exception until the design owner answers.
// Foreground on background as axe reports them; any other low-contrast pair fails.
const Q8_PAIRS = new Set([
	'#7384a4 on #ffffff', // text-secondary on surface-default
	'#7384a4 on #f5f5f6', // text-secondary on surface-subtle
	'#ffffff on #1890ff', // text on action-primary (primary button)
	'#1890ff on #ffffff', // link (action-primary) on surface-default
]);

const pair = (data: unknown) => {
	const { fgColor, bgColor } = (data ?? {}) as { fgColor?: string; bgColor?: string };
	return `${fgColor} on ${bgColor}`;
};

async function violations(page: Page, exclude: string[] = []) {
	// Controls that turn enabled once the session loads fade in (`transition`); WebKit scanned them mid-fade (webkit-768
	// color-contrast). Settle every transition first, as the browser a11y unit tests do.
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
	});
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	let builder = new AxeBuilder({ page }).withTags(TAGS);
	for (const selector of exclude) builder = builder.exclude(selector);
	const results = await builder.analyze();

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => ({
			id: v.id,
			nodes: v.id === 'color-contrast' ? v.nodes.filter((n) => !Q8_PAIRS.has(pair(n.any[0]?.data))) : v.nodes,
		}))
		.filter((v) => v.nodes.length > 0)
		.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const PUBLIC = ['/admin/login', '/admin/reset-password', '/admin/accept-invite?token=x', '/admin/register'];
// `profile`: your own user page, opened from the avatar menu (no /users/me route, D-86).
// Spec 020: Settings > Extensions with the fixture extensions.
const PRIVATE = [
	'/admin/content',
	'profile',
	'/admin/files/not-there',
	'/admin/khong-co',
	'/admin/settings/extensions',
];

for (const scheme of ['light', 'dark'] as const) {
	test(`public and private screens have no serious violations (${scheme})`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme });
		const found: Record<string, string[]> = {};

		for (const path of PUBLIC) {
			await page.goto(path);
			await expect(page.locator('h1').first()).toBeVisible();
			found[path] = await violations(page);
		}

		await resetLastPage(api);
		await page.goto('/admin/login');
		await login(page, ADMIN);
		await expect(page).toHaveURL(CONTENT_URL);

		for (const path of PRIVATE) {
			if (path === 'profile') {
				await openOwnPage(page);
				// The header actions turn on once the user and its permissions load (WebKit at 768 px scanned them off).
				await expect(page.getByRole('button', { name: 'Archive' })).toBeEnabled();
			} else await page.goto(path);
			await expect(page.locator('h1').first()).toBeVisible();
			// Feature 015: the user page loads its form and interfaces after the title; scan the settled page, not
			// colors in the middle of a load or a transition.
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(300);
			found[path] = await violations(page);
		}

		expect(Object.fromEntries(Object.entries(found).filter(([, v]) => v.length))).toEqual({});
	});
}

// The flow icon of the table rows takes the color the flow stores (Directus does the same): user data, not a token.
const FLOW_COLOR = ['main tbody [data-icon][style*="color"]'];

// Feature 017 T094 (FR-106, SC-008): the Flows screens, light and dark: the flow table, the bo_all_ops page in view and
// edit mode, the flow drawer on both tabs, the operation drawer of exec, mail (D-106 notice) and trigger, the Logs
// section and a run's drawer. The canvas is mouse-only like Directus (approved exception): axe still checks its DOM.
for (const scheme of ['light', 'dark'] as const) {
	test(`Flows screens have no serious violations (${scheme})`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.emulateMedia({ colorScheme: scheme });
		const all = await flowId(api, FLOWS.all);
		const operations = await api.call<{ id: string; key: string }[]>(
			'GET',
			`/operations?filter[flow][_eq]=${all}&fields=id,key&limit=-1`,
		);
		const operation = (key: string) => operations.find((o) => o.key === key)!.id;
		const found: Record<string, string[]> = {};
		const scan = async (name: string) => {
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(300);
			found[name] = await violations(page, FLOW_COLOR);
		};
		const dialog = () => page.getByRole('dialog');

		await resetLastPage(api);
		await page.goto('/admin/login');
		await login(page, ADMIN);
		await expect(page).toHaveURL(CONTENT_URL);

		await page.goto('/admin/settings/flows');
		await expect(page.locator('main tbody tr').first()).toBeVisible();
		await scan('flow table');

		await page.getByRole('button', { name: 'Create Flow' }).first().click();
		await expect(dialog()).toBeVisible();
		await scan('flow drawer, setup tab');
		await dialog().getByRole('textbox', { name: /^Name/ }).fill('a11y');
		await page.getByRole('button', { name: 'Next' }).click();
		await dialog()
			.getByRole('button', { name: /^Webhook/ })
			.click();
		await scan('flow drawer, trigger tab');
		await page.keyboard.press('Escape');
		await expect(dialog()).toHaveCount(0);

		await page.goto(`/admin/settings/flows/${all}`);
		await expect(panel(page, '$trigger')).toBeVisible();
		await scan('flow page');
		await page.getByRole('button', { name: 'Edit Flow' }).click();
		await scan('flow page, edit mode');

		for (const key of ['exec', 'mail', 'trigger']) {
			await page.goto(`/admin/settings/flows/${all}/${operation(key)}`);
			await expect(dialog()).toContainText('Edit Operation');
			await scan(`operation drawer ${key}`);
		}

		await page.goto(`/admin/settings/flows/${all}`);
		await expect(panel(page, '$trigger')).toBeVisible();
		await openSidebar(page);
		await page.getByRole('button', { name: /^Logs/ }).click();
		await expect(page.locator('[data-flow-log] button').first()).toBeVisible();
		await scan('logs section');
		await page.locator('[data-flow-log] button').first().click();
		await expect(page.locator('[data-flow-log-steps]')).toBeVisible();
		await scan('log drawer');

		expect(Object.fromEntries(Object.entries(found).filter(([, v]) => v.length))).toEqual({});
	});
}

// Feature 018 T115 (FR-106, SC-008): the Insights, Activity and notifications screens, light and dark: the dashboards
// table, bo_dash_all in view and edit mode, the panel drawer of a metric, a time series and a variable, the activity
// list and an activity drawer, the notifications drawer on both tabs. Colors the user stores (dashboard and panel
// colors, conditional formatting, chart series) are user data, as in Directus: excluded like the flow icon colors.
const INSIGHTS_USER_COLORS = [
	'[data-icon][style*="color"]',
	'[style*="color"] > [data-icon]',
	'[data-panel-id] [style*="color"]',
	'[data-panel-id] .apexcharts-canvas',
];

for (const scheme of ['light', 'dark'] as const) {
	test(`Insights, Activity and notifications screens have no serious violations (${scheme})`, async ({ page }) => {
		test.setTimeout(180_000);
		await page.emulateMedia({ colorScheme: scheme });
		const all = await dashboardId(api, DASHBOARDS.all);
		const panels = await api.call<{ id: string; type: string }[]>(
			'GET',
			`/panels?filter[dashboard][_eq]=${all}&fields=id,type&limit=-1`,
		);
		const panelOf = (type: string) => panels.find((p) => p.type === type)!.id;
		const found: Record<string, string[]> = {};
		const scan = async (name: string) => {
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(300);
			found[name] = await violations(page, INSIGHTS_USER_COLORS);
		};
		const dialog = () => page.getByRole('dialog');

		await resetLastPage(api);
		await page.goto('/admin/login');
		await login(page, ADMIN);
		await expect(page).toHaveURL(CONTENT_URL);

		await page.goto('/admin/insights');
		await expect(page.locator('main tbody tr').first()).toBeVisible();
		await scan('dashboards table');

		await page.goto(`/admin/insights/${all}`);
		await expect(page.locator('[data-panel-type="metric"]')).toContainText('12');
		await scan('dashboard');
		await page.getByRole('button', { name: 'Edit Panels' }).click();
		await scan('dashboard, edit mode');

		for (const type of ['metric', 'time-series', 'variable']) {
			await page.goto(`/admin/insights/${all}/${panelOf(type)}`);
			await expect(dialog()).toContainText('Panel Options');
			await scan(`panel drawer ${type}`);
		}

		await page.goto('/admin/activity');
		await expect(page.locator('main tbody tr').first()).toBeVisible();
		await scan('activity');
		await page.locator('main tbody tr').first().click();
		await expect(dialog()).toBeVisible();
		await scan('activity drawer');
		await page.keyboard.press('Escape');

		await openNotificationsPanel(page);
		await scan('notifications panel');
		await page.getByRole('button', { name: 'View all', exact: true }).click();
		await expect(page.locator('[data-notifications-drawer]')).toBeVisible();
		await scan('notifications inbox');
		await dialog().getByRole('tab', { name: 'Archive' }).click();
		await scan('notifications archive');

		expect(Object.fromEntries(Object.entries(found).filter(([, v]) => v.length))).toEqual({});
	});
}

test('keyboard only: sign in, open Files, open and close the avatar menu, sign out (FR-027, FR-067)', async ({
	page,
}) => {
	test.skip(
		page.viewportSize()!.width < 1280,
		'below lg the module bar sits in the navigation drawer (navigation.spec)',
	);
	await resetLastPage(api);
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();

	const focused = () =>
		page.evaluate(() => document.activeElement?.getAttribute('name') ?? document.activeElement?.textContent?.trim());

	const tabTo = async (predicate: () => Promise<boolean>, max = 30, key = 'Tab') => {
		for (let i = 0; i < max; i++) {
			if (await predicate()) return;
			await page.keyboard.press(key);
		}
		throw new Error('focus never reached the target');
	};

	await tabTo(async () => (await focused()) === 'email');
	await page.keyboard.type(ADMIN.email);
	await page.keyboard.press('Tab');
	expect(await focused()).toBe('password');
	await page.keyboard.type(ADMIN.password);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(CONTENT_URL);

	const files = page.getByTestId('module-bar').locator('a[href="/admin/files"]');
	await tabTo(() => files.evaluate((el) => el === document.activeElement));
	expect(await files.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/admin\/files$/);

	// The user menu sits under the sidebar logo, before the modules (owner 2026-10-20).
	const avatar = page
		.locator('#navigation')
		.getByRole('button', { name: /Admin|User/ })
		.first();
	await tabTo(() => avatar.evaluate((el) => el === document.activeElement), 30, 'Shift+Tab');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menuitem').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(avatar).toBeFocused();

	await page.keyboard.press('Enter');
	await page.getByRole('menuitem', { name: 'Sign Out' }).focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);
});
