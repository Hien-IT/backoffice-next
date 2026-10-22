// US6 (T064, contracts/e2e.md §2) moved to the user page by feature 015 (FR-051, D-48 lifted, T082): the own page is
// /users/<id>; the form saves only the changed fields, shows API errors on the field, and language, appearance and
// theme overrides apply at once and after a reload. "Save and Stay" keeps the page (Save goes to the directory, as in
// Directus).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { closeHostDb } from './helpers/db-rows.js';
import { Fixtures, PASSWORD, type TestUser } from './helpers/fixtures.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { moduleBar } from './helpers/layout.js';

let api: AdminApi;
let fixtures: Fixtures;
let user: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	user = await fixtures.user('profile', {
		role: await fixtures.role('profile', { updateSelf: ['*'] }),
		first_name: 'Ada',
		last_name: 'E2E',
	});
	// Settings overrides win over the user's (like Directus): none during this spec.
	await api.patchSettings({ theme_light_overrides: null, theme_dark_overrides: null, default_appearance: 'auto' });
});

test.beforeEach(async () => {
	await api.call('PATCH', `/users/${user.id}`, {
		data: {
			password: PASSWORD,
			language: null,
			appearance: null,
			theme_light_overrides: null,
			theme_dark_overrides: null,
			last_page: null,
		},
	});
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	await fixtures.cleanup();
	await closeHostDb();
});

async function openProfile(page: Page) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin/users/${user.id}`);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function save(page: Page) {
	await page.getByRole('button', { name: /^(More save options|Thêm tùy chọn lưu)$/i }).click();
	await page.getByRole('menuitem', { name: /^(Save and Stay|Lưu và ở lại)/ }).click();
}

async function choose(page: Page, label: string, option: string) {
	// The select is labelled by its field label and its current value.
	await page.getByRole('combobox', { name: new RegExp(`^${label}\\b`) }).click();
	await page.getByRole('option', { name: option, exact: true }).click();
}

test('saves only the changed fields; the new name shows in the avatar menu (US6-1, FR-060)', async ({ page }) => {
	await openProfile(page);
	await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Ada');

	const patch = page.waitForRequest(
		(r) => r.method() === 'PATCH' && new URL(r.url()).pathname.endsWith(`/users/${user.id}`),
	);
	await page.getByLabel('First Name', { exact: true }).fill('Grace');
	await save(page);
	expect((await patch).postDataJSON()).toEqual({ first_name: 'Grace' });

	// The user menu at the bottom of the sidebar (D-157; in the drawer below `xl`) is named after the user.
	await moduleBar(page);
	await expect(page.getByRole('button', { name: 'Grace E2E' })).toBeVisible();
});

test('an email used by another user shows the unique error on the field (US6-1)', async ({ page }) => {
	await openProfile(page);
	await page.getByLabel('Email', { exact: true }).fill(ADMIN.email);
	await save(page);

	// The message shows in the form notice and under the field.
	await expect(page.getByText('Value has to be unique').first()).toBeVisible();
});

test('a new password works at the next sign-in (US6-1)', async ({ page }) => {
	// trackPage writes last_page 500 ms after a navigation: wait for it so the sign-in lands on the user page
	// (FR-018) and no PATCH is still pending when the cookies go (slow webkit raced both).
	const tracked = page.waitForResponse(
		(r) => r.url().endsWith('/users/me/track/page') && r.request().postDataJSON()?.last_page === `/users/${user.id}`,
	);
	await openProfile(page);
	await tracked;
	await page.getByLabel('Password', { exact: true }).fill('web-e2e-New-Password2');
	// The Save button is disabled while saving too: wait for the answer before the cookies go.
	const saved = page.waitForResponse(
		(r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname.endsWith(`/users/${user.id}`),
	);
	await save(page);
	expect((await saved).ok()).toBe(true);

	// A fresh browser state: only the new password matters here (sign-out is covered by login.spec). Let the lazy chunks
	// of the user page finish first: WebKit reports an aborted module import as a console error.
	await page.waitForLoadState('networkidle');
	await page.context().clearCookies();
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
	await login(page, { email: user.email, password: 'web-e2e-New-Password2' });
	await expect(page).toHaveURL(new RegExp(`/admin/users/${user.id}$`));
	// The test ends on the user page: let its lazy chunks load before the page closes (same WebKit error as above).
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');
});

test('vi-VN applies at once and after a reload, without raw keys (US6-2, SC-006)', async ({ page }) => {
	await openProfile(page);
	await choose(page, 'Language', 'Vietnamese (Vietnam)');
	await save(page);

	await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN');
	await expect(page.getByLabel('Họ', { exact: true })).toBeVisible();

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN');

	const rawKeys = await page.evaluate(() => {
		// Icon ligatures (Material Symbols names such as account_circle) are aria-hidden text, not translations.
		const body = document.body.cloneNode(true) as HTMLElement;
		body.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
		return body.innerText.split('\n').filter((line) => /^[a-z]+(_[a-z]+)+$/.test(line.trim()));
	});
	expect(rawKeys).toEqual([]);
});

test('appearance dark, light and auto with the system scheme (US6-3, FR-063)', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await openProfile(page);
	await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/);

	await choose(page, 'Appearance', 'Dark');
	await save(page);
	await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
	await page.reload();
	await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);

	await choose(page, 'Appearance', 'Automatic (Sync with System)');
	await save(page);
	await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/);
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
});

test('a light theme override changes the design-system token (US6-4, D-43)', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await openProfile(page);

	// system-theme-overrides (feature 015): the root rules sit in the collapsed "globals" group of the light overrides.
	const light = page.locator('[data-theme-overrides]').first();
	await light.getByRole('button', { name: 'globals' }).click();
	await light.getByRole('textbox', { name: 'primary', exact: true }).fill('#aa0000');
	await save(page);
	await expect
		.poll(() =>
			page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim()),
		)
		.toBe('#aa0000');
});
