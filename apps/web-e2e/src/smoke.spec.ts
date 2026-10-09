import { expect, test } from '@playwright/test';

// Smoke test of the web skeleton (US7, FR-003). The API answer is stubbed so the test does not depend on which
// API runs behind the page; config.json is read at run time, so changing it changes the URL the app calls.
test('opens /admin/, shows Backoffice and the ping result', async ({ page }) => {
	await page.route('**/server/ping', (route) => route.fulfill({ body: 'pong' }));
	await page.goto('/admin/');

	await expect(page.getByRole('heading', { name: 'Backoffice' })).toBeVisible();
	await expect(page.getByTestId('ping-result')).toHaveText('pong');
});

test('calls the API URL from config.json', async ({ page }) => {
	const apiUrl = 'http://api.backoffice.test';
	let pinged = '';

	await page.route('**/admin/config.json', (route) => route.fulfill({ json: { apiUrl } }));
	await page.route(`${apiUrl}/server/ping`, (route) => {
		pinged = route.request().url();
		return route.fulfill({ body: 'pong', headers: { 'access-control-allow-origin': '*' } });
	});
	await page.goto('/admin/');

	await expect(page.getByTestId('ping-result')).toHaveText('pong');
	expect(pinged).toBe(`${apiUrl}/server/ping`);
});
