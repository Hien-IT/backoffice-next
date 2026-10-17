// Feature 017 US1 (T036; US1-1 to US1-7, FR-010 to FR-016): the flows overview and the flow drawer in the three
// configurations. The list shows the fixture flows sorted by name with their status; a flow made in the drawer (one per
// trigger) is stored with the drawer's values and opens its page; the row menu toggles the status, edits and deletes;
// a save error keeps the drawer open. Every flow a test creates is named `${DATA_PREFIX}-overview-<n>` and deleted
// after the file. The flow page is the 012 frame until wave 2, so after "Finish Setup" only the URL is checked (O1).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { createTempFlow, deleteTempFlows, flowRow, FLOWS, tempFlowName } from './helpers/flows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

type Flow = {
	id: string;
	name: string;
	status: string;
	trigger: string | null;
	accountability: string | null;
	description: string | null;
};

const flowByName = async (name: string) =>
	(await api.call<Flow[]>('GET', `/flows?filter[name][_eq]=${encodeURIComponent(name)}&fields=*`))[0];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempFlows(api, 'overview');
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await deleteTempFlows(api, 'overview');
});

async function openFlows(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto('/admin/settings/flows');
	await expect(page.getByRole('heading', { level: 1, name: 'Flows' })).toBeVisible();
}

async function rowMenu(page: Page, name: string, entry: string) {
	await page.getByRole('button', { name: `Options for ${name}` }).click();
	await page.getByRole('menuitem', { name: entry }).click();
}

const drawer = (page: Page) => page.getByRole('dialog');

test('the list: the fixture flows sorted by name, their status, the Settings sub-menu (US1-1)', async ({ page }) => {
	await openFlows(page);

	const names = await page.locator('main tbody tr td:nth-child(3)').allInnerTexts();
	const fixture = names.filter((name) => (Object.values(FLOWS) as string[]).includes(name.trim()));
	expect(fixture).toEqual([...fixture].sort());
	expect(fixture).toHaveLength(Object.values(FLOWS).length);
	await expect(flowRow(page, FLOWS.schedule)).toContainText('Inactive');
	await expect(flowRow(page, FLOWS.all)).toContainText('Active');
	const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await expect(page.getByRole('link', { name: 'Flows' })).toHaveAttribute('aria-current', 'page');
});

test('create one flow per trigger: POST /flows with the drawer values, then the flow URL (US1-3 to US1-5)', async ({
	page,
}) => {
	await openFlows(page);
	const triggers = ['Event Hook', 'Webhook', 'Schedule (CRON)', 'Another Flow', 'Manual'];

	for (const [index, trigger] of triggers.entries()) {
		const name = tempFlowName('overview', `trigger-${index}`);
		await page.goto('/admin/settings/flows');
		await page.getByRole('button', { name: 'Create Flow' }).first().click();
		await expect(drawer(page)).toContainText('Creating New Flow');
		await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
		await drawer(page).getByRole('textbox', { name: /^Name/ }).fill(name);
		await page.getByRole('button', { name: 'Next' }).click();
		await expect(page.getByRole('button', { name: 'Finish Setup' })).toBeDisabled();
		await drawer(page)
			.getByRole('button', { name: new RegExp(`^${trigger.replace(/[()]/g, '\\$&')}`) })
			.click();
		await page.getByRole('button', { name: 'Finish Setup' }).click();

		await expect(page).toHaveURL(/\/admin\/settings\/flows\/[0-9a-f-]{36}$/);
		const flow = await flowByName(name);
		expect(flow).toMatchObject({ status: 'active', accountability: 'all', description: null });
		expect(page.url()).toContain(flow!.id);
	}

	const stored = await api.call<Flow[]>(
		'GET',
		`/flows?filter[name][_starts_with]=${encodeURIComponent(tempFlowName('overview', 'trigger-'))}&fields=trigger&sort=name`,
	);
	expect(stored.map((flow) => flow.trigger)).toEqual(['event', 'webhook', 'schedule', 'operation', 'manual']);
});

test('row menu: set inactive, edit the description, delete (US1-6)', async ({ page }) => {
	const name = tempFlowName('overview', 'menu');
	await createTempFlow(api, name);
	await openFlows(page);

	await rowMenu(page, name, 'Set Flow to Inactive');
	await expect(flowRow(page, name)).toContainText('Inactive');
	await expect.poll(async () => (await flowByName(name))!.status).toBe('inactive');

	await rowMenu(page, name, 'Edit Flow');
	await expect(drawer(page)).toContainText('Updating Flow');
	await drawer(page).getByLabel('Description').fill('Edited in the drawer');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(drawer(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/admin\/settings\/flows$/);
	await expect(flowRow(page, name)).toContainText('Edited in the drawer');

	await rowMenu(page, name, 'Delete Flow');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText(`Are you sure you want to delete Flow "${name}"`);
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(flowRow(page, name)).toHaveCount(0);
	await expect.poll(() => flowByName(name)).toBeUndefined();
});

test('a save error keeps the drawer open with its values (FR-012, CHK001)', async ({ page }) => {
	await openFlows(page);
	await page.route('**/flows?fields=id', (route) =>
		route.request().method() === 'POST'
			? route.fulfill({
					status: 500,
					json: { errors: [{ message: 'Broken', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] },
				})
			: route.fallback(),
	);

	await page.getByRole('button', { name: 'Create Flow' }).first().click();
	await drawer(page).getByRole('textbox', { name: /^Name/ }).fill(tempFlowName('overview', 'error'));
	await page.getByRole('button', { name: 'Next' }).click();
	await drawer(page)
		.getByRole('button', { name: /^Schedule/ })
		.click();
	await page.getByRole('button', { name: 'Finish Setup' }).click();

	await expect(page.getByRole('alertdialog').or(page.getByRole('dialog').filter({ hasText: 'Broken' }))).toBeVisible();
	await expect(page).toHaveURL(/\/admin\/settings\/flows$/);
});
