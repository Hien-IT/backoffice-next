// US7 (T065, FR-002, FR-072, SC-001): a full walk through the app (sign-in, the six modules, profile, sign-out) calls
// only the routes of contracts/api-calls.md. Every other spec checks the same after each test (helpers/requests.ts);
// this one also asserts which out-of-scope APIs are never touched.
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { openOwnPage } from './helpers/users.js';

test.afterAll(closeHostDb);

test('sign-in, six modules, profile and sign-out call only the allowed API routes (FR-002, FR-072)', async ({
	page,
	apiRequests,
}) => {
	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });

	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);

	for (const path of [
		'/admin/files',
		'/admin/users',
		'/admin/insights',
		'/admin/activity',
		'/admin/settings',
		'/admin/content',
	]) {
		await page.goto(path);
		await moduleBar(page);
	}

	await openOwnPage(page);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.goto('/admin/logout');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);

	const paths = apiRequests.map((r) => r.path);
	expect(paths.length).toBeGreaterThan(10);
	// Feature 014: the Content module reads /items like the Directus app; the other Directus-only routes stay unused.
	expect(paths.filter((p) => /^\/(websocket|extensions|graphql|mcp|ai|deployments)(\/|$)/.test(p))).toEqual([]);
});
