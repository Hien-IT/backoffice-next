// Spec 031 (D-212, FR-017 to FR-020, FR-024, contracts/tests.md §4): Settings > Extensions > Upload extension. At
// proxy-directus (the API is Directus) there is no Upload button. At proxy-api and cors: upload the committed
// parity-upload-endpoint tarball, see its row with the Uploaded chip and Enabled, a file that is not a package keeps the
// dialog open with the API reason, the dialog has no serious axe violation, and Uninstall from the row menu removes it.
import type { APIRequestContext, Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AdminApi } from './helpers/api.js';
import { ADMIN, apiUrl, CONTENT_URL, e2eConfig, isCors } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.describe.configure({ mode: 'serial' });

const FIXTURES = new URL('../../../tests/fixtures/extensions/', import.meta.url);
const PACKAGE = fileURLToPath(new URL('parity-upload-endpoint/parity-upload-endpoint-1.0.0.tgz', FIXTURES));
const NOT_A_PACKAGE = fileURLToPath(new URL('parity-upload-endpoint/package.json', FIXTURES));
const NAME = 'parity-upload-endpoint';

/** The Backoffice APIs that load extensions in this configuration (Directus never loads an uploaded package, D-212.1). */
const BACKOFFICE_NODES = isCors ? [apiUrl] : [...new Set(['http://127.0.0.1:8156', apiUrl])];

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	// A run cut short leaves the package: uninstall it (files and rows), then drop any row left.
	const rows = await hostDb()('directus_extensions').where({ source: 'upload', bundle: null }).select('id');
	for (const { id } of rows) await api.call('DELETE', `/extensions/registry/uninstall/${id}`).catch(() => undefined);
	await hostDb()('directus_extensions').where({ source: 'upload' }).delete();
	await closeHostDb();
});

async function open(page: Page) {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto('/admin/settings/extensions');
	await expect(page.getByRole('heading', { level: 1, name: 'Extensions' })).toBeVisible();
}

const row = (page: Page) => page.locator(`[data-extension="${NAME}"]`);

/** Every Backoffice node lists the package with its schema (status `status` of its endpoint). */
async function served(request: APIRequestContext, status: number) {
	await expect
		.poll(
			async () => {
				const answers = await Promise.all(BACKOFFICE_NODES.map((url) => request.get(`${url}/${NAME}`)));
				return answers.every((res) => res.status() === status);
			},
			{ timeout: 30_000 },
		)
		.toBe(true);
}

async function scan(page: Page) {
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
	});
	const results = await new AxeBuilder({ page })
		.include('[role="dialog"]')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

test('no Upload extension button when the API is Directus (proxy-directus)', async ({ page }) => {
	test.skip(e2eConfig !== 'proxy-directus', 'the button exists at Backoffice only');

	await open(page);
	await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Upload extension' })).toHaveCount(0);
});

test('upload a package: a file that is not one keeps the dialog open with the reason; then the row, Uploaded, Enabled', async ({
	page,
	request,
}) => {
	test.skip(e2eConfig === 'proxy-directus', 'the button exists at Backoffice only');

	await open(page);
	await page.getByRole('button', { name: 'Upload extension' }).click();
	const dialog = page.getByRole('dialog', { name: 'Upload extension' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('npm pack');
	expect(await scan(page)).toEqual([]);

	// Named .tgz so the dialog sends it: the API answers why it is not a package.
	await dialog.getByTestId('extension-upload-input').setInputFiles({
		name: 'not-a-package.tgz',
		mimeType: 'application/gzip',
		buffer: readFileSync(NOT_A_PACKAGE),
	});
	await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
	await expect(dialog.getByRole('alert')).toContainText('The file is not a gzipped tar archive');
	await expect(dialog).toBeVisible();

	await dialog.getByTestId('extension-upload-input').setInputFiles(PACKAGE);
	await expect(dialog.getByTestId('extension-upload-file')).toContainText('parity-upload-endpoint-1.0.0.tgz');
	await dialog.getByRole('button', { name: 'Upload', exact: true }).click();

	await expect(dialog).toHaveCount(0);
	await expect(page.getByText(`Extension "${NAME}" installed.`)).toBeVisible();
	await expect(row(page)).toContainText('Uploaded');
	await expect(row(page)).toContainText('Enabled');
	await served(request, 200);
});

test('Uninstall from the row menu removes the package everywhere', async ({ page, request }) => {
	test.skip(e2eConfig === 'proxy-directus', 'the button exists at Backoffice only');

	await open(page);
	await row(page)
		.getByRole('button', { name: /options/i })
		.click();
	await expect(page.getByRole('menuitem', { name: 'Reinstall' })).toHaveCount(0);
	await page.getByRole('menuitem', { name: 'Uninstall' }).click();

	await expect(row(page)).toHaveCount(0);
	await served(request, 404);
	expect(await hostDb()('directus_extensions').where({ source: 'upload' })).toEqual([]);
});
