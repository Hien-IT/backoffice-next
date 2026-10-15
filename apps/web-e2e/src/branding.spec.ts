// US3 (T050, contracts/e2e.md §2): no "Directus" in the app with default settings; the branding of the settings
// (name, descriptor, logo, color, favicon, background, note, custom CSS, project URL) applied like the Directus app.
// Screenshots of both apps are kept as artifacts only (SC-005, not a gate).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, apiUrl, CONTENT_URL, directusUrl } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const BRANDING = [
	'project_name',
	'project_descriptor',
	'project_logo',
	'project_color',
	'project_url',
	'public_background',
	'public_foreground',
	'public_favicon',
	'public_note',
	'custom_css',
] as const;

const PNG = readFileSync(new URL('../../web/public/favicon.ico', import.meta.url));

let api: AdminApi;
let before: Record<string, unknown>;
const files: string[] = [];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const settings = await api.getSettings();
	before = Object.fromEntries(BRANDING.map((key) => [key, settings[key] ?? null]));
	// The values of a database Directus just created: project_name and project_color are NOT NULL with these
	// defaults, which the app shows as Backoffice (D-51); the rest is empty.
	await api.patchSettings({
		...Object.fromEntries(BRANDING.map((key) => [key, null])),
		project_name: 'Directus',
		project_color: '#6644FF',
	});
	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	await api.patchSettings(before);
	for (const id of files) await api.deleteFile(id);
	await closeHostDb();
});

async function noDirectus(page: Page) {
	await expect(page).not.toHaveTitle(/Directus/);
	expect(await page.evaluate(() => document.body.innerText)).not.toContain('Directus');
}

test('default settings of a new Directus database: Backoffice everywhere, no "Directus" (US3-1, SC-005, FR-082, D-51)', async ({
	page,
}) => {
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
	await noDirectus(page);
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/admin/favicon.ico');
	await expect(page.getByRole('img', { name: 'Backoffice' }).first()).toBeAttached();
	await expect(page.getByText('Backoffice').first()).toBeVisible();
	await page.screenshot({ path: test.info().outputPath('branding-login-backoffice.png') });

	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	// Feature 014: /content lands on a collection, whose name is the page title.
	await expect(page).toHaveTitle(/^.+ · Backoffice$/);
	await noDirectus(page);

	await page.goto('/admin/users/me');
	await moduleBar(page);
	await noDirectus(page);
});

test('settings branding is applied on the login page and in the app (US3-2..4)', async ({ page, browser }) => {
	const upload = async (name: string) => {
		const file = await api.uploadFile({ name, mimeType: 'image/x-icon', buffer: PNG }, { title: name });
		files.push(file.id);
		return file.id;
	};

	const logo = await upload('web-e2e-logo.ico');
	const favicon = await upload('web-e2e-favicon.ico');
	const background = await upload('web-e2e-background.ico');

	await api.patchSettings({
		project_name: 'Acme Backoffice E2E',
		project_descriptor: 'Branding test',
		project_logo: logo,
		project_color: '#336699',
		project_url: 'https://example.com/',
		public_background: background,
		public_favicon: favicon,
		public_note: 'Read [the guide](https://example.com/guide) <script>window.__xss = 1</script>',
		custom_css: '.e2e-marker-target { display: none !important; }',
	});

	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
	await expect(page).toHaveTitle('Sign In · Acme Backoffice E2E');
	await expect(page.getByText('Branding test')).toBeVisible();
	await expect(page.locator(`img[src*="/assets/${logo}"]`).first()).toBeVisible();
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#336699');
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', `${apiUrl}/assets/${favicon}`);

	const note = page.getByRole('link', { name: 'the guide' });
	await expect(note).toHaveAttribute('href', 'https://example.com/guide');
	expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

	const projectColor = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim(),
	);
	expect(projectColor).toBe('#336699');

	// custom_css is in effect: an element with the marker class is hidden.
	expect(
		await page.evaluate(() => {
			const el = document.createElement('div');
			el.className = 'e2e-marker-target';
			document.body.append(el);
			return getComputedStyle(el).display;
		}),
	).toBe('none');
	await page.screenshot({ path: test.info().outputPath('branding-login-backoffice-settings.png') });

	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await expect(page).toHaveTitle(/^.+ · Acme Backoffice E2E$/);
	// The module bar logo links to project_url (FR-026).
	await moduleBar(page);
	await expect(page.locator('a[href="https://example.com/"]').first()).toBeVisible();

	// Reference only (SC-005): the Directus app with the same settings.
	const directus = await browser.newPage();
	await directus.goto(`${directusUrl}/admin/login`);
	await directus.waitForLoadState('networkidle').catch(() => undefined);
	await directus.screenshot({ path: test.info().outputPath('branding-login-directus-settings.png') });
	await directus.close();
});
