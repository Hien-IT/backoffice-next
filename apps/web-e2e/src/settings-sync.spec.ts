// Spec 032 (D-214.1, FR-031..FR-036, FR-039, contracts/tests.md §4): Settings > Environment Sync. At proxy-directus (the
// API is Directus) there is no entry and the page is the not-found page. At proxy-api and cors the target is the API of
// the configuration and the source is backoffice-api-sync of profile sync (its own database), seeded through its REST
// API: compare, tick a flow and a collection, confirm, see them in the target; reload empties the form; tick a delete,
// the confirm dialog names it with a danger button, and it is gone after the apply.
import type { APIRequestContext, Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX, e2eConfig, parseEnv } from './helpers/config.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.describe.configure({ mode: 'serial' });

const SOURCE_API = 'http://127.0.0.1:10856';
const SOURCE_IN_DOCKER = 'http://backoffice-api-sync:8055';
const SOURCE_TOKEN = parseEnv(
	readFileSync(new URL('../../../tests/parity/env/profile-sync.env', import.meta.url), 'utf8'),
)['ADMIN_TOKEN']!;

const run = Date.now().toString(36);
const FLOW = { id: randomUUID(), name: `${DATA_PREFIX} sync flow ${run}` };
const LOCAL_FLOW = { id: randomUUID(), name: `${DATA_PREFIX} local flow ${run}` };
const COLLECTION = `e2e_sync_${e2eConfig.replace(/-/g, '_')}_${run}`;
const backoffice = e2eConfig !== 'proxy-directus';

let api: AdminApi;
let source: APIRequestContext;

const sourceCall = (method: 'POST' | 'DELETE', path: string, data?: unknown) =>
	source.fetch(`${SOURCE_API}${path}`, {
		method,
		headers: { authorization: `Bearer ${SOURCE_TOKEN}` },
		...(data ? { data } : {}),
	});

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	source = await playwright.request.newContext();
	if (!backoffice) return;

	for (const [path, data] of [
		[
			'/collections',
			{
				collection: COLLECTION,
				meta: { icon: 'sync' },
				schema: {},
				fields: [
					{
						field: 'id',
						type: 'integer',
						meta: { hidden: true },
						schema: { is_primary_key: true, has_auto_increment: true },
					},
				],
			},
		],
		['/flows', { id: FLOW.id, name: FLOW.name, icon: 'bolt', status: 'active', trigger: 'manual', options: {} }],
	] as const) {
		const response = await sourceCall('POST', path, data);
		expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
	}
});

test.afterAll(async () => {
	if (!backoffice) return;

	for (const id of [FLOW.id, LOCAL_FLOW.id]) await api.call('DELETE', `/flows/${id}`).catch(() => undefined);
	await api.call('DELETE', `/collections/${COLLECTION}`).catch(() => undefined);
	await sourceCall('DELETE', `/flows/${FLOW.id}`).catch(() => undefined);
	await sourceCall('DELETE', `/collections/${COLLECTION}`).catch(() => undefined);
});

async function open(page: Page) {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto('/admin/settings/sync');
}

async function compare(page: Page) {
	await page.getByLabel('Source URL').fill(SOURCE_IN_DOCKER);
	await page.getByLabel('Static admin token of the source').fill(SOURCE_TOKEN);
	await page.getByRole('button', { name: 'Compare', exact: true }).click();
	await expect(page.getByText(/^Source: Backoffice/)).toBeVisible({ timeout: 30_000 });
}

async function scan(page: Page) {
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
	});
	const results = await new AxeBuilder({ page })
		.include('main')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

test('no Environment Sync entry and a not-found page when the API is Directus (proxy-directus)', async ({ page }) => {
	test.skip(backoffice, 'the page exists at Backoffice only');

	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto('/admin/settings/data-model');
	await expect(page.getByRole('heading', { level: 1, name: 'Data Model' })).toBeVisible();
	// Below `xl` the sub-menu is in the closed drawer; the row must not exist at any width.
	await expect(page.locator('a[href$="/settings/sync"]')).toHaveCount(0);

	await page.goto('/admin/settings/sync');
	await expect(page.getByLabel('Static admin token of the source')).toHaveCount(0);
});

test('compare, tick a flow and a collection, confirm, and find them in the target; reload empties the form', async ({
	page,
}) => {
	test.skip(!backoffice, 'the page exists at Backoffice only');
	test.setTimeout(120_000);

	await open(page);
	await expect(page.getByRole('heading', { level: 1, name: 'Environment Sync' })).toBeVisible();
	await compare(page);

	await page.getByRole('checkbox', { name: `Select ${FLOW.name}` }).click();
	await page.getByRole('checkbox', { name: `Select ${COLLECTION}` }).click();
	expect(await scan(page)).toEqual([]);

	await page.getByRole('button', { name: /Apply \(2\)/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Apply environment sync?' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('These flows are active and start running here at once');
	await expect(dialog).toContainText(FLOW.name);
	await dialog.getByRole('button', { name: 'Apply', exact: true }).click();

	// The result heading (the toast says "Environment sync applied").
	await expect(page.getByRole('heading', { name: 'Applied', exact: true })).toBeVisible({ timeout: 60_000 });
	expect(await api.call('GET', `/flows/${FLOW.id}`)).toMatchObject({ name: FLOW.name });
	expect(await api.call('GET', `/collections/${COLLECTION}`)).toMatchObject({ collection: COLLECTION });

	await page.reload();
	await expect(page.getByLabel('Source URL')).toHaveValue('');
	await expect(page.getByLabel('Static admin token of the source')).toHaveValue('');
});

test('a ticked delete is named in the confirm dialog with a danger button and is gone after the apply', async ({
	page,
}) => {
	test.skip(!backoffice, 'the page exists at Backoffice only');
	test.setTimeout(120_000);

	await api.call('POST', '/flows', {
		data: { id: LOCAL_FLOW.id, name: LOCAL_FLOW.name, status: 'inactive', trigger: 'manual', options: {} },
	});

	await open(page);
	await compare(page);
	await page.getByRole('checkbox', { name: `Select ${LOCAL_FLOW.name}` }).click();
	await page.getByRole('button', { name: /Apply \(1\)/ }).click();

	const dialog = page.getByRole('dialog', { name: 'Apply environment sync?' });
	await expect(dialog).toContainText('Deleted here');
	await expect(dialog).toContainText(LOCAL_FLOW.name);
	await expect(dialog).toContainText('Deletes cannot be undone.');
	await dialog.getByRole('button', { name: 'Apply', exact: true }).click();

	// The result heading (the toast says "Environment sync applied").
	await expect(page.getByRole('heading', { name: 'Applied', exact: true })).toBeVisible({ timeout: 60_000 });
	await expect(api.call('GET', `/flows/${LOCAL_FLOW.id}`)).rejects.toThrow();
});
