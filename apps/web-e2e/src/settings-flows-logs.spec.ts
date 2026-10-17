// Feature 017 US4 (T074; US4-1 to US4-5, FR-050 to FR-055): the Logs section of bo_all_ops in the three configurations,
// on the three runs the seed made (two resolve, one reject through throw-error; no test runs bo_all_ops, CHK007): the
// badge, the day group, the status of each run, "Show Failed Only", the drawer of the reject with its steps.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { openSidebar } from './helpers/content.js';
import { flowId, FLOWS } from './helpers/flows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

async function openLogs(page: Page) {
	const id = await flowId(api, FLOWS.all);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin/settings/flows/${id}`);
	// The page header (and its panel toggle) must be there before openSidebar looks for the toggle.
	await expect(page.locator('[data-panel-key="$trigger"]')).toBeVisible();
	await openSidebar(page);
	const section = page.getByRole('button', { name: /^Logs/ });
	await expect(section).toContainText('3');
	await section.click();
}

const runs = (page: Page) => page.locator('[data-flow-log] button');

test('the badge, the runs with their status, Show Failed Only (US4-1 to US4-3)', async ({ page }) => {
	await openLogs(page);

	await expect(runs(page)).toHaveCount(3);
	expect(await runs(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-status')))).toEqual([
		'reject',
		'resolve',
		'resolve',
	]);

	const toggle = page.getByRole('button', { name: /Show Failed Only/ });
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(runs(page)).toHaveCount(1);
	await expect(runs(page).first()).toHaveAttribute('data-status', 'reject');
});

test('the drawer of the reject: the trigger step and the steps condition, throw_error (US4-4)', async ({ page }) => {
	await openLogs(page);
	await runs(page).first().click();

	const steps = page.locator('[data-flow-log-steps]');
	await expect(steps).toContainText('Trigger');
	await expect(steps).toContainText('Manual');
	expect(
		await steps
			.locator('[data-step]')
			.evaluateAll((els) => els.map((el) => [el.getAttribute('data-step'), el.getAttribute('data-status')])),
	).toEqual([
		['condition', 'reject'],
		['throw_error', 'reject'],
	]);
	await steps.getByRole('button', { name: 'Payload' }).first().click();
	await expect(steps).toContainText('"reason": "fail"');
});
