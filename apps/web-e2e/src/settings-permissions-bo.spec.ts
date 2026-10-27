// Spec 025 (US3, FR-028, FR-034, D-189): the import and export parts of the modules follow the import and export
// permissions of the policies (rows of backoffice_permissions, written by the admin through /backoffice/permissions)
// and /permissions/me. A user reading bo_content, directus_users and directus_files with create and update on
// bo_content starts with neither; an export row limited to CSV shows the export part with CSV only; an import row
// shows the import part. Behind proxy-directus the API is Directus 11.17.4, without import and export keys: the export
// part follows read and the import part create and update, as the Directus app (FR-034).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { DATA_PREFIX, e2eConfig } from './helpers/config.js';
import { openCollection, openSidebar } from './helpers/content.js';
import { Fixtures, type TestUser } from './helpers/fixtures.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const ROLE = 'bo permissions reader';
const isDirectusApi = e2eConfig === 'proxy-directus';

test.describe.configure({ mode: 'serial' });

let api: AdminApi;
let fixtures: Fixtures;
let reader: TestUser;
let policy: string;

const q = (value: unknown) => encodeURIComponent(JSON.stringify(value));

async function grant(collection: string, action: 'import' | 'export', formats?: string[]) {
	await api.call('POST', '/backoffice/permissions', {
		data: { policy, collection, action, fields: ['*'], options: formats ? { formats } : null },
	});
	await api.call('POST', '/utils/cache/clear');
}

async function revokeAll() {
	if (isDirectusApi) return;
	const rows = await api.call<{ id: number }[]>(
		'GET',
		`/backoffice/permissions?filter=${q({ policy: { _eq: policy } })}&fields=id&limit=-1`,
	);
	if (rows.length) await api.call('DELETE', '/backoffice/permissions', { data: rows.map((row) => row.id) });
	await api.call('POST', '/utils/cache/clear');
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	const role = await fixtures.role(ROLE, { read: ['bo_content', 'directus_users', 'directus_files'] });
	policy = (
		await api.call<{ id: string }[]>(
			'GET',
			`/policies?filter=${q({ name: { _eq: `${DATA_PREFIX} ${ROLE}` } })}&fields=id`,
		)
	)[0]!.id;
	for (const action of ['create', 'update']) {
		await api.call('POST', '/permissions', {
			data: { policy, collection: 'bo_content', action, fields: ['*'], permissions: {}, validation: {} },
		});
	}
	reader = await fixtures.user('bo-permissions', { role });
});

test.afterEach(revokeAll);

test.afterAll(async () => {
	await revokeAll();
	await fixtures.cleanup();
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, reader);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
}

const section = (page: Page) => page.getByRole('button', { name: /^Import \/ Export/ });

async function openSection(page: Page, path: string) {
	if (path.startsWith('/content/')) await openCollection(page, path.slice('/content/'.length));
	else await page.goto(`/admin${path}`);
	await openSidebar(page);
	await section(page).click();
}

test('no import or export permission: no import / export section on Content', async ({ page }) => {
	await signIn(page);
	await openCollection(page, 'bo_content');
	await openSidebar(page);

	if (isDirectusApi) {
		// Directus rules: read gives the export part, create and update the import part.
		await section(page).click();
		await expect(page.getByRole('button', { name: 'Export Items' })).toBeVisible();
		await expect(page.locator('#import-file')).toBeAttached();
		return;
	}

	await expect(section(page)).toHaveCount(0);
});

test('export limited to CSV: the export part with CSV only, no import part', async ({ page }) => {
	test.skip(isDirectusApi, 'Directus has no /backoffice/permissions (FR-034)');
	await grant('bo_content', 'export', ['csv']);
	await signIn(page);
	await openSection(page, '/content/bo_content');

	await expect(page.locator('#import-file')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Download Page as CSV' })).toBeVisible();
	await page.getByRole('button', { name: 'Export Items' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export Items' });
	await dialog.getByRole('combobox', { name: 'Format' }).click();
	await expect(page.getByRole('option')).toHaveCount(1);
	await expect(page.getByRole('option', { name: /^CSV/ })).toBeVisible();
});

test('import: the import part, without the export part', async ({ page }) => {
	test.skip(isDirectusApi, 'Directus has no /backoffice/permissions (FR-034)');
	await grant('bo_content', 'import');
	await signIn(page);
	await openSection(page, '/content/bo_content');

	await expect(page.locator('#import-file')).toBeAttached();
	await expect(page.getByRole('button', { name: 'Export Items' })).toHaveCount(0);
});

for (const [module, collection] of [
	['/users', 'directus_users'],
	['/files', 'directus_files'],
] as const) {
	test(`${module}: the export part follows the export permission of ${collection}`, async ({ page }) => {
		test.skip(isDirectusApi, 'Directus has no /backoffice/permissions (FR-034)');
		await signIn(page);
		await page.goto(`/admin${module}`);
		await openSidebar(page);
		await expect(section(page)).toHaveCount(0);

		await grant(collection, 'export');
		await openSection(page, module);
		await expect(page.getByRole('button', { name: 'Export Items' })).toBeVisible();
		// Import into a system collection stays admin-only, as Directus.
		await expect(page.locator('#import-file')).toHaveCount(0);
	});
}
