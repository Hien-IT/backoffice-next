// Feature 014 US5 (T064; US5-1 to US5-3, US5-6, FR-080 to FR-084, FR-089): the detail panel of the item page on
// bo_content/1 of the fixture set (two seeded edits, two comments, the share `bo-share`, the manual flow
// `bo-flow-item`). Comments a test posts are deleted afterwards. Not tagged @core: chromium only (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { openItem, openSidebar } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterEach(async () => {
	const mine = await api.call<{ id: string }[]>(
		'GET',
		`/comments?fields=id&filter[comment][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	for (const comment of mine) await api.call('DELETE', `/comments/${comment.id}`);
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

const section = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) });

test('revisions: the seeded edits, the comparison modal of one (US5-1, FR-080, FR-081)', async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', 1);
	await openSidebar(page);

	await section(page, 'Revisions').click();
	const revision = page
		.getByRole('complementary')
		.getByRole('button')
		.filter({ hasText: /Edited|Updated|Created/ })
		.first();
	await expect(revision).toBeVisible();
	await revision.click();

	// Below `xl` the detail panel is a dialog too: the comparison modal is the one with Cancel.
	const modal = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Cancel' }) });
	await expect(modal).toBeVisible();
	await modal.getByRole('button', { name: 'Cancel' }).click();
	await expect(modal).toHaveCount(0);
});

test('comments: post with Ctrl/Cmd+Enter, then it shows in the list (US5-2, FR-082)', async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', 1);
	await openSidebar(page);

	await section(page, 'Comments').click();
	const input = page.getByRole('textbox', { name: 'Leave a comment...' });
	await input.fill(`${DATA_PREFIX} a comment`);
	const posted = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/comments'));
	await input.press('ControlOrMeta+Enter');
	expect((await posted).postDataJSON()).toMatchObject({
		collection: 'bo_content',
		item: '1',
		comment: `${DATA_PREFIX} a comment`,
	});
	await expect(page.getByRole('complementary').getByText(`${DATA_PREFIX} a comment`)).toBeVisible();
});

test('shares and flows: the seeded share and the manual flow of the item (US5-3, US5-6, FR-083, FR-089)', async ({
	page,
}) => {
	await signIn(page);
	await openItem(page, 'bo_content', 1);
	await openSidebar(page);

	await section(page, 'Shares').click();
	await expect(page.getByRole('complementary').getByText('bo-share')).toBeVisible();

	await section(page, 'Flows').click();
	await expect(page.getByRole('complementary').getByRole('button', { name: /bo-flow-item/ })).toBeVisible();
});

test('a new item has no detail sections (FR-084)', async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', '+');
	await openSidebar(page);

	await expect(section(page, 'Revisions')).toHaveCount(0);
	await expect(section(page, 'Comments')).toHaveCount(0);
});
