// Feature 014 US6 (T078; US6-1 to US6-3, FR-090 to FR-092): "Download Page as CSV" byte-equal to the file the Directus
// app gives (fixtures/interfaces/snapshot/expected.content.csv), the export dialog download, import of a CSV of 10 rows.
// Imported rows carry DATA_PREFIX and are deleted afterwards.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX } from './helpers/config.js';
import { openCollection, openSidebar, waitForTable } from './helpers/content.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const EXPECTED_CSV = new URL('../../web/fixtures/interfaces/snapshot/expected.content.csv', import.meta.url);

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterEach(async () => {
	const rows = await api.call<{ id: number }[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (rows.length) await api.call('DELETE', '/items/bo_content', { data: rows.map((r) => r.id) });
});

async function openSection(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await openSidebar(page);
	await page.getByRole('button', { name: /^Import \/ Export/ }).click();
}

test('"Download Page as CSV" gives the bytes of the Directus app (US6-1, FR-092)', async ({ page }) => {
	await openSection(page);

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download Page as CSV' }).click(),
	]);
	const bytes = readFileSync((await download.path())!);
	expect(bytes.equals(readFileSync(EXPECTED_CSV))).toBe(true);
});

test('export dialog: JSON download with the screen query (US6-2, FR-090)', async ({ page }) => {
	await openSection(page);

	await page.getByRole('button', { name: 'Export Items' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export Items' });
	await dialog.getByRole('combobox', { name: 'Format' }).click();
	await page.getByRole('option', { name: 'JSON', exact: true }).click();

	const exported = page.waitForRequest(
		(r) => r.url().includes('/items/bo_content?') && r.url().includes('export=json'),
	);
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download File' }).click(),
	]);
	await exported;
	const rows = JSON.parse(readFileSync((await download.path())!, 'utf8')) as unknown[];
	expect(rows.length).toBeGreaterThan(0);
});

test('import a CSV of 10 rows (US6-3, FR-091)', async ({ page }) => {
	await openSection(page);

	const csv = ['title,status', ...Array.from({ length: 10 }, (_, i) => `${DATA_PREFIX} import ${i},draft`)].join('\n');
	await page
		.locator('input#import-file')
		.setInputFiles({ name: 'web-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

	const imported = page.waitForResponse(
		(r) => r.request().method() === 'POST' && r.url().includes('/utils/import/bo_content'),
	);
	await page.getByRole('button', { name: 'Start Import' }).click();
	expect((await imported).ok()).toBe(true);

	await api.call('POST', '/utils/cache/clear');
	const rows = await api.call<unknown[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(`${DATA_PREFIX} import`)}`,
	);
	expect(rows).toHaveLength(10);
});
