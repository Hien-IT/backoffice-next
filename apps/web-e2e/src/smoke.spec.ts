import { expect, test } from './helpers/requests.js';

// Smoke test of the three configurations (T031, contracts/e2e.md §2): signed out, /admin/ lands on the login page.
// The page title follows the Directus template (`<page> · <project name || Backoffice>`) once the app head lands
// (T039); until then index.html's title stays.
test('opens /admin/ and lands on the login page', async ({ page }) => {
	await page.goto('/admin/');

	await expect(page).toHaveURL(/\/admin\/login$/);
	await expect(page).toHaveTitle(/Backoffice/);
});
