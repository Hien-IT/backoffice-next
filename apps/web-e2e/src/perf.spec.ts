// SC-008, FR-074 (T066): the login page shows in under 3 s on 10 Mbps with a cold cache (chromium, CDP throttling),
// and no layout scrolls horizontally at 768 and 1280 px.
import { ADMIN } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.afterAll(closeHostDb);

test('login page visible in under 3 s at 10 Mbps, cold cache (SC-008)', async ({ page, browserName, context }) => {
	test.skip(browserName !== 'chromium', 'CDP throttling is chromium only');

	const cdp = await context.newCDPSession(page);
	await cdp.send('Network.enable');
	await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
	await cdp.send('Network.emulateNetworkConditions', {
		offline: false,
		latency: 20,
		downloadThroughput: (10 * 1024 * 1024) / 8,
		uploadThroughput: (10 * 1024 * 1024) / 8,
	});

	const start = Date.now();
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible({ timeout: 10_000 });
	const elapsed = Date.now() - start;

	test.info().annotations.push({ type: 'login visible (ms)', description: String(elapsed) });
	expect(elapsed).toBeLessThan(3000);
});

test('no horizontal scroll on login, content and profile (FR-028, SC-008)', async ({ page }) => {
	const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
	expect(await noScroll()).toBe(true);

	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/content$/);
	expect(await noScroll()).toBe(true);

	await page.goto('/admin/users/me');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	expect(await noScroll()).toBe(true);
});
