// Feature 016 US5 (T092; US5-1 to US5-5, FR-002): the Project and Appearance pages. Edit the project name and save
// (`PATCH /settings`, the 012 shell updates), switch Insights off and add a link in the module bar (the sidebar follows),
// set the project color on Appearance, change the owner through system-owner (`POST /settings/owner`);
// `/content/directus_settings` opens the Project page. The settings are restored after the file.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { moduleBar } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;
let original: Record<string, unknown>;
const KEYS = ['project_name', 'module_bar', 'project_color', 'project_owner', 'project_usage', 'org_name'] as const;
const NAME = `${DATA_PREFIX} project`;
const LINK = `${DATA_PREFIX} wiki`;

test.describe.configure({ mode: 'serial' });

const settings = () => api.call<Record<string, any>>('GET', `/settings?fields=${KEYS.join(',')}`);

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	original = await settings();
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterAll(async () => {
	await api.call('PATCH', '/settings', { data: original });
});

async function signIn(page: Page, path: string) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin${path}`);
}

const field = (page: Page, name: string) => page.locator(`main [data-field="${name}"]`);

test('project name: PATCH /settings with the edited key; the shell shows it (US5-1, US5-2)', async ({ page }) => {
	await signIn(page, '/settings/project');
	await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeDisabled();

	const patch = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/settings'));
	await field(page, 'project_name').getByRole('textbox').fill(NAME);
	await save.click();
	expect((await patch).postDataJSON()).toEqual({ project_name: NAME });

	// The button is disabled while saving as well: wait for the stored value.
	await expect.poll(async () => (await settings())['project_name']).toBe(NAME);
	await expect(page).toHaveTitle(new RegExp(NAME));
});

test('module bar: Insights off and a new link; the sidebar follows (US5-4)', async ({ page }) => {
	await signIn(page, '/settings/project');

	const bar = field(page, 'module_bar');
	await bar.getByRole('switch', { name: 'Insights' }).click();

	await bar.getByRole('button', { name: 'Add Link' }).click();
	const drawer = page.getByRole('dialog', { name: 'Custom Link' });
	await drawer.locator('[data-field="name"]').getByRole('textbox').fill(LINK);
	await drawer.locator('[data-field="url"]').getByRole('textbox').fill('https://example.com/wiki');
	await drawer.locator('[data-field="icon"] button[aria-haspopup="dialog"]').click();
	await page.getByRole('searchbox').last().fill('menu_book');
	await page.locator('[data-icon-button="menu_book"]').first().click();
	await drawer.getByRole('button', { name: 'Save' }).click();
	await expect(drawer).toBeHidden();

	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect.poll(async () => (await settings())['module_bar'] !== null).toBe(true);

	const saved = (await settings())['module_bar'] as { type: string; id: string; enabled: boolean; name?: string }[];
	expect(saved.find((part) => part.id === 'insights')?.enabled).toBe(false);
	expect(saved.find((part) => part.type === 'link' && part.name === LINK)).toBeTruthy();
	// The Directus default comes along: the docs link and the visual / deployments modules stay in the data.
	expect(saved.map((part) => part.id)).toEqual(expect.arrayContaining(['docs', 'visual', 'deployments']));

	const sidebar = await moduleBar(page);
	await expect(sidebar.getByRole('link', { name: 'Insights' })).toHaveCount(0);
	await expect(sidebar.getByRole('link', { name: LINK })).toBeVisible();
});

test('appearance: the project color is saved (US5-5)', async ({ page }) => {
	await signIn(page, '/settings/appearance');
	await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible();
	await expect(field(page, 'project_name')).toHaveCount(0);

	const color = field(page, 'project_color').getByRole('textbox');
	await color.fill('#2ECDA7');
	await color.press('Tab');
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	await expect.poll(async () => String((await settings())['project_color']).toUpperCase()).toBe('#2ECDA7');
});

test('owner: the system-owner drawer posts /settings/owner (US5-3)', async ({ page }) => {
	await signIn(page, '/settings/project');

	await field(page, 'project_owner').getByRole('button', { name: 'Edit Project Owner' }).click();
	const drawer = page.getByRole('dialog', { name: 'Update Project Owner' });
	const post = page.waitForRequest(
		(request) => request.method() === 'POST' && request.url().endsWith('/settings/owner'),
	);
	await drawer.locator('[data-field="project_owner"]').getByRole('textbox').fill(`owner-${DATA_PREFIX}@example.com`);
	await drawer.getByRole('button', { name: 'Save' }).click();

	expect((await post).postDataJSON()).toMatchObject({ project_owner: `owner-${DATA_PREFIX}@example.com` });
	await expect(drawer).toBeHidden();
	await expect.poll(async () => (await settings())['project_owner']).toBe(`owner-${DATA_PREFIX}@example.com`);
});

test('/content/directus_settings opens the Project page (FR-002, D-72)', async ({ page }) => {
	await signIn(page, '/content/directus_settings');

	await expect(page).toHaveURL(/\/admin\/settings\/project$/);
});
