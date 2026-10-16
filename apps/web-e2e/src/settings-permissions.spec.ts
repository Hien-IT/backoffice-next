// Feature 016 US7 (T113; FR-001, FR-061): a user without admin access. The Settings module is not in the module bar,
// its routes give the private "page not found" (the module is not registered, as Directus), and the API refuses every
// write of the Settings screens (403) on both APIs. Test values of the fixture user bo-editor from
// apps/web/fixtures/interfaces/lib.mjs (USERS).
import type { APIRequestContext, Page } from '@playwright/test';
import { apiUrl } from './helpers/config.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const EDITOR = { email: 'bo-editor@example.com', password: 'bo-editor-test-password' };

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, EDITOR);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

async function editorToken(request: APIRequestContext): Promise<string> {
	const response = await request.post(`${apiUrl}/auth/login`, { data: EDITOR });
	expect(response.ok()).toBe(true);
	return ((await response.json()) as { data: { access_token: string } }).data.access_token;
}

test('no Settings in the module bar; every Settings route is "page not found" (FR-001)', async ({ page }) => {
	await signIn(page);
	const bar = await moduleBar(page);
	await expect(bar.getByRole('link', { name: 'Settings' })).toHaveCount(0);

	for (const path of ['/settings/data-model', '/settings/roles', '/settings/policies', '/settings/project']) {
		await page.goto(`/admin${path}`);
		await expect(page.getByRole('heading', { level: 2, name: 'Page Not Found' })).toBeVisible();
	}
});

test('the API refuses the Settings writes of a non-admin with 403 (FR-061)', async ({ playwright }) => {
	const request = await playwright.request.newContext();
	const headers = { Authorization: `Bearer ${await editorToken(request)}` };

	const writes: [string, string, unknown][] = [
		['POST', '/collections', { collection: 'bo_forbidden', schema: {}, meta: {} }],
		['PATCH', '/collections/bo_content', { meta: { note: 'x' } }],
		['POST', '/fields/bo_content', { field: 'forbidden', type: 'string' }],
		['POST', '/relations', { collection: 'bo_content', field: 'x', related_collection: 'directus_users' }],
		['POST', '/roles', { name: 'forbidden' }],
		['POST', '/policies', { name: 'forbidden' }],
		['POST', '/permissions', [{ collection: 'bo_content', action: 'read', fields: ['*'] }]],
		['PATCH', '/settings', { project_name: 'forbidden' }],
		['POST', '/translations', { key: 'forbidden', language: 'en-US', value: 'x' }],
	];

	for (const [method, path, data] of writes) {
		const response = await request.fetch(`${apiUrl}${path}`, { method, headers, data });
		expect(response.status(), `${method} ${path}`).toBe(403);
	}

	await request.dispose();
});
