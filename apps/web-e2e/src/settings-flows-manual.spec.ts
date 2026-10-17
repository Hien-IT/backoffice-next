// Feature 017 US5 (T082; US5-1 to US5-4, FR-060 to FR-062): a manual flow made for the test runs from the Content pages
// of bo_content in the three configurations: its button shows in the Flows section of the list and of the item, the
// confirmation asks for the required `reason`, the run sends POST /flows/trigger/<id> and its log row appears; an async
// flow answers at once. The flows are named `${DATA_PREFIX}-manual-<n>` and deleted after the file.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { openItem, openSidebar } from './helpers/content.js';
import { createTempFlow, deleteTempFlows, tempFlowName } from './helpers/flows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

const CONFIRM = tempFlowName('manual', 'confirm');
const ASYNC = tempFlowName('manual', 'async');

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempFlows(api, 'manual');
	const id = await createTempFlow(api, CONFIRM, {
		options: {
			collections: ['bo_content'],
			location: 'both',
			requireSelection: true,
			requireConfirmation: true,
			confirmationDescription: 'Run it?',
			fields: [{ field: 'reason', type: 'string', name: 'Reason', meta: { interface: 'input', required: true } }],
		},
	});
	await api.call('PATCH', `/flows/${id}`, {
		data: {
			operations: { create: [], update: [], delete: [] },
			operation: {
				flow: id,
				name: 'Log',
				key: 'log',
				type: 'log',
				position_x: 19,
				position_y: 1,
				options: { message: '{{ $trigger.body.reason }}' },
			},
		},
	});
	await createTempFlow(api, ASYNC, { options: { collections: ['bo_content'], location: 'item', async: true } });
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await deleteTempFlows(api, 'manual');
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

const flowsSection = (page: Page) => page.getByRole('button', { name: /^Flows/ });
const runCount = async (name: string) => {
	const [flow] = await api.call<{ id: string }[]>('GET', `/flows?filter[name][_eq]=${name}&fields=id`);
	const rows = await api.call<unknown[]>(
		'GET',
		`/revisions?filter[collection][_eq]=directus_flows&filter[item][_eq]=${flow!.id}&fields=id&limit=-1`,
	);
	return rows.length;
};

test('the list: the button needs a selection; the confirmation asks the reason; the run is logged (US5-1, US5-2)', async ({
	page,
}) => {
	await signIn(page);
	await page.goto('/admin/content/bo_content');
	await expect(page.locator('main tbody tr').first()).toBeVisible();
	await openSidebar(page);
	await flowsSection(page).click();

	const button = page.getByRole('complementary').getByRole('button', { name: new RegExp(CONFIRM) });
	await expect(button).toBeDisabled();
	await expect(page.getByRole('complementary').getByRole('button', { name: new RegExp(ASYNC) })).toHaveCount(0);

	// Below xl the detail panel is a modal drawer over the table: close it to select, then open it again.
	const close = page.getByRole('button', { name: 'Close sidebar', exact: true });
	if (await close.isVisible()) await close.click();
	await page.locator('main tbody tr').nth(0).getByRole('checkbox').check();
	await page.locator('main tbody tr').nth(1).getByRole('checkbox').check();
	await openSidebar(page);
	if (!(await button.isVisible())) await flowsSection(page).click();
	await expect(button).toBeEnabled();
	const before = await runCount(CONFIRM);
	await button.click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('Run it?');
	const confirm = dialog.getByRole('button', { name: /Run Flow/ });
	await expect(confirm).toBeDisabled();
	await dialog.getByRole('textbox').fill('from the list');
	const trigger = page.waitForRequest((r) => r.method() === 'POST' && /\/flows\/trigger\//.test(r.url()));
	await confirm.click();
	const body = (await trigger).postDataJSON() as Record<string, unknown>;
	expect(body).toMatchObject({ reason: 'from the list', collection: 'bo_content' });
	expect(body['keys']).toHaveLength(2);
	await expect.poll(() => runCount(CONFIRM)).toBe(before + 1);
});

test('the item: both flows; the async one runs at once (US5-1, US5-4)', async ({ page }) => {
	await signIn(page);
	await openItem(page, 'bo_content', 1);
	await openSidebar(page);
	await flowsSection(page).click();

	await expect(page.getByRole('complementary').getByRole('button', { name: new RegExp(CONFIRM) })).toBeVisible();
	const asyncButton = page.getByRole('complementary').getByRole('button', { name: new RegExp(ASYNC) });
	const trigger = page.waitForResponse((r) => r.request().method() === 'POST' && /\/flows\/trigger\//.test(r.url()));
	await asyncButton.click();
	expect((await trigger).ok()).toBe(true);
	expect((await trigger).request().postDataJSON()).toEqual({ collection: 'bo_content', keys: ['1'] });
});
