// Feature 014 US7 (T085, SC-002): the same screen in the Directus app (DIRECTUS_URL/admin) and in the new app shows the
// same collection tree (labels and order), the same default columns, the same count line, the same create-button
// state and the same detail-panel sections, for the admin, bo-editor and bo-viewer. Runs in E2E_CONFIG=proxy-api only, like the
// payload suite. Directus-only sections (AI Assistant, D-41) are left out.
import type { Page } from '@playwright/test';
import { ADMIN, e2eConfig } from './helpers/config.js';
import { onDirectusApp, goto as gotoDirectus } from './helpers/directus-app.js';
import { openCollection, openSidebar } from './helpers/content.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

// Test values of the fixture users, from apps/web/fixtures/interfaces/lib.mjs (USERS).
const EDITOR = { email: 'bo-editor@example.com', password: 'bo-editor-test-password' };
const VIEWER = { email: 'bo-viewer@example.com', password: 'bo-viewer-test-password' };

type Screen = { tree: string[]; columns: string[]; count: string; createDisabled: boolean; sections: string[] };

test.skip(e2eConfig !== 'proxy-api', 'compares with the Directus app of the main pair (proxy-api only)');

async function directusScreen(page: Page): Promise<Screen> {
	await gotoDirectus(page, '/content/bo_content');
	await expect(page.locator('.item-count')).toHaveText(/\d+ Items?/);
	// The header actions (the create link or its disabled button) come after the count.
	await expect(page.locator('header .button').last()).toBeVisible();
	await page.waitForTimeout(500);
	return {
		tree: await page
			.locator('.module-nav .v-list-item, .content-navigation .v-list-item')
			.evaluateAll((items) =>
				items.map((i) => (i.querySelector('.v-text-overflow, .v-list-item-content') ?? i).textContent!.trim()),
			),
		columns: (await page.locator('.v-table th').allTextContents()).map((t) => t.trim()).filter(Boolean),
		count: (await page.locator('.item-count').textContent())!.trim(),
		createDisabled: (await page.locator('a[href$="/content/bo_content/+"]').count()) === 0,
		sections: (
			await page.getByRole('contentinfo').locator('.accordion-trigger, .collapsible-trigger').allTextContents()
		)
			.map((t) => t.trim())
			.filter((t) => t && t !== 'AI Assistant'),
	};
}

async function backofficeScreen(page: Page, user: { email: string; password: string }): Promise<Screen> {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
	await openCollection(page, 'bo_content');
	const status = page
		.getByRole('main')
		.getByRole('status')
		.filter({ hasText: /\d+ Items?/ })
		.first();
	await expect(status).toBeAttached({ timeout: 10_000 });
	// Below `xl` the navigation and the detail panel are modal drawers (the rest of the page is hidden from the
	// accessibility tree while one is open): read the main area first, then each drawer in turn.
	const columns = (await page.getByRole('main').getByRole('table').getByRole('columnheader').allTextContents())
		.map((t) => t.replace(/arrow_drop_down|arrow_upward|arrow_downward|add|sort/g, '').trim())
		.filter(Boolean);
	const count = ((await status.textContent()) ?? '').match(/\d+ Items?/)![0];
	const createDisabled = (await page.getByRole('link', { name: 'Create Item' }).count()) === 0;
	await moduleBar(page);
	const tree = await page
		.getByRole('tree', { name: 'Collections' })
		.getByRole('treeitem')
		.evaluateAll((items) =>
			items.map((i) => {
				// The row without its icons (Material Symbols ligatures), screen-reader texts and row menu.
				const row = (i.firstElementChild ?? i).cloneNode(true) as HTMLElement;
				row.querySelectorAll('.material-symbols-rounded, .sr-only, button').forEach((e) => e.remove());
				return row.textContent!.trim();
			}),
		);
	const navigation = page.getByRole('dialog', { name: 'Navigation' });
	if (await navigation.isVisible()) {
		await page.keyboard.press('Escape');
		await expect(navigation).toBeHidden();
	}
	await openSidebar(page);
	const sections = (await page.locator('#sidebar h3').allTextContents()).map((t) =>
		t.replace(/expand_more|[a-z_]+(?=[A-Z])/g, '').trim(),
	);
	return { tree, columns, count, createDisabled, sections };
}

for (const [name, user] of [
	['admin', ADMIN],
	['bo-editor', EDITOR],
	['bo-viewer', VIEWER],
] as const) {
	test(`${name}: tree, columns, count, create state and panel sections match the Directus app (SC-002)`, async ({
		page,
		browser,
	}) => {
		const directus = await onDirectusApp(browser, directusScreen, user);
		const backoffice = await backofficeScreen(page, user);

		expect(backoffice.count).toBe(directus.count);
		expect(backoffice.createDisabled).toBe(directus.createDisabled);
		expect(backoffice.columns).toEqual(directus.columns);
		expect(backoffice.tree.slice(0, directus.tree.length)).toEqual(directus.tree);
		expect(backoffice.sections).toEqual(directus.sections);
	});
}
