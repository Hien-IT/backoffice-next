// US6 (T064, contracts/e2e.md §2): the profile page (/users/me) saves only the changed fields, shows API errors on the
// field, and language, appearance and theme overrides apply at once and after a reload.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN } from './helpers/config.js';
import { closeHostDb } from './helpers/db-rows.js';
import { Fixtures, PASSWORD, type TestUser } from './helpers/fixtures.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

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
	await expect(page).toHaveURL(/\/admin\/content$/);
	await page.goto('/admin/users/me');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

const save = (page: Page) => page.getByRole('button', { name: /^(Save|Lưu)$/ }).click();

async function choose(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label }).click();
	await page.getByRole('option', { name: option, exact: true }).click();
}

test('saves only the changed fields; the new name shows in the avatar menu (US6-1, FR-060)', async ({ page }) => {
	await openProfile(page);
	await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Ada');

	const patch = page.waitForRequest((r) => r.method() === 'PATCH' && new URL(r.url()).pathname.endsWith('/users/me'));
	await page.getByLabel('First Name', { exact: true }).fill('Grace');
	await save(page);
	expect((await patch).postDataJSON()).toEqual({ first_name: 'Grace' });

	await moduleBar(page);
	await expect(page.getByRole('button', { name: 'Grace E2E' })).toBeVisible();
});

test('an email used by another user shows the unique error on the field (US6-1)', async ({ page }) => {
	await openProfile(page);
	await page.getByLabel('Email', { exact: true }).fill(ADMIN.email);
	await save(page);

	await expect(page.getByText('Value has to be unique')).toBeVisible();
});

test('a new password works at the next sign-in (US6-1)', async ({ page }) => {
	await openProfile(page);
	await page.getByLabel('Password', { exact: true }).fill('web-e2e-New-Password2');
	await save(page);
	await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

	// A fresh browser state: only the new password matters here (sign-out is covered by login.spec).
	await page.context().clearCookies();
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
	await login(page, { email: user.email, password: 'web-e2e-New-Password2' });
	await expect(page).toHaveURL(/\/admin\/content$/);
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

test('a light theme override changes the design-system token; invalid JSON is refused (US6-4, D-43)', async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await openProfile(page);

	const overrides = page.getByLabel('Light Theme Customization', { exact: true });
	await overrides.fill('{ not json');
	await save(page);
	await expect(page.getByText('Invalid Input')).toBeVisible();

	await overrides.fill('{"primary":"#aa0000"}');
	await save(page);
	await expect
		.poll(() =>
			page.evaluate(() =>
				getComputedStyle(document.documentElement).getPropertyValue('--eh-color-action-primary').trim(),
			),
		)
		.toBe('#aa0000');
});
