// Feature 017 T091 (SC-002, SC-003, FR-102, contracts/tests.md §5): a flow made in one app opens and is edited in the
// other. (1) A manual flow and 4 operations made in the Backoffice app show at the same cells with the same arrows in
// the Directus app, whose Condition drawer has the same option. (2) An operation the Directus app adds shows in the
// Backoffice app. (3) A flow and 2 operations made in the Directus app open the same in the Backoffice app. (4) Runs
// from the item page of both apps are in the Logs of both, each run's drawer showing the reason of the other app's
// run. (5) A flow with the "Another Flow" trigger made in the Backoffice app is a choice of the Trigger Flow operation
// in the Directus app. Through the API: the confirmation `reason` field of flow (1) (the inline fields editor is
// covered by settings-flows-overview). Runs at proxy-api only, in chromium at 1280 px (DIRECTUS_APP_SPECS of
// playwright.config.ts). The flows are named `${DATA_PREFIX}-xflow-<n>` and deleted before and after the file.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, e2eConfig } from './helpers/config.js';
import { openItem, openSidebar } from './helpers/content.js';
import {
	card,
	chooseInMenu,
	countDirectusArrows,
	dirAddOperation,
	dirSaveFlow,
	dirTile,
	field,
	goto,
	headerButton,
	onDirectusApp,
	openDirectusFlow,
	openSidebarSection,
	readDirectusGrid,
	sidebar,
} from './helpers/directus-app.js';
import {
	addOperation,
	countArrows,
	deleteTempFlows,
	editFlow,
	flowId,
	panel,
	panelByPrefix,
	readGrid,
	saveFlow,
	tempFlowName,
} from './helpers/flows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'drives the Directus app of the main pair (proxy-api only)');
test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });
test.setTimeout(180_000);

const BO_FLOW = tempFlowName('xflow', 'bo');
const DIR_FLOW = tempFlowName('xflow', 'dir');
const CHILD = tempFlowName('xflow', 'child');

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempFlows(api, 'xflow');
});

test.afterAll(async () => {
	await deleteTempFlows(api, 'xflow');
});

async function signIn(page: Page) {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

/** The cells of the panels, without names: the Directus app heads a tile with the operation type, not its key. */
const cells = (grid: { x: number; y: number }[]) => grid.map(({ x, y }) => `${x}:${y}`).sort();

async function openBackofficeFlow(page: Page, id: string) {
	await page.goto(`/admin/settings/flows/${id}`);
	await expect(panel(page, '$trigger')).toBeVisible({ timeout: 15_000 });
}

/** Creates a manual flow on bo_content through the Backoffice drawer; returns its id. */
async function createInBackoffice(page: Page, name: string, trigger: RegExp) {
	await page.goto('/admin/settings/flows');
	await page.getByRole('button', { name: 'Create Flow' }).first().click();
	const drawer = page.getByRole('dialog');
	await drawer.getByRole('textbox', { name: /^Name/ }).fill(name);
	await page.getByRole('button', { name: 'Next' }).click();
	await drawer.getByRole('button', { name: trigger }).click();
	if (trigger.test('Manual')) await drawer.getByRole('checkbox', { name: 'Bo Content', exact: true }).check();
	await page.getByRole('button', { name: 'Finish Setup' }).click();
	await expect(page).toHaveURL(/\/settings\/flows\/[0-9a-f-]{36}$/, { timeout: 30_000 });
	return flowId(api, name);
}

test('(1) a flow and 4 operations made in the Backoffice app open the same in the Directus app (SC-002)', async ({
	page,
	browser,
}) => {
	await signIn(page);
	const id = await createInBackoffice(page, BO_FLOW, /^Manual/);
	await editFlow(page);
	await addOperation(page, panel(page, '$trigger'), 'resolve', 'Condition');
	await addOperation(page, panelByPrefix(page, 'condition_'), 'resolve', 'Log to Console');
	await addOperation(page, panelByPrefix(page, 'condition_'), 'reject', 'Throw Error');
	await addOperation(page, panelByPrefix(page, 'log_'), 'resolve', 'Transform Payload');
	await saveFlow(page);
	const grid = await readGrid(page);
	await expect.poll(() => countArrows(page)).toEqual({ resolve: 3, reject: 1 });

	const [condition] = await api.call<{ id: string }[]>(
		'GET',
		`/operations?filter[flow][_eq]=${id}&filter[type][_eq]=condition&fields=id`,
	);
	await page.goto(`/admin/settings/flows/${id}/${condition!.id}`);
	await expect(page.getByRole('dialog').locator('[data-field="filter"]')).toContainText('Condition Rules');

	await onDirectusApp(browser, async (p) => {
		await openDirectusFlow(p, id);
		expect(cells(await readDirectusGrid(p))).toEqual(cells(grid));
		await expect.poll(() => countDirectusArrows(p)).toEqual({ resolve: 3, reject: 1 });
		await goto(p, `/settings/flows/${id}/${condition!.id}`);
		await expect(field(p.locator('.v-drawer').last(), 'Condition Rules')).toBeVisible();
	});
});

test('(2) an operation the Directus app adds shows in the Backoffice app (SC-002)', async ({ page, browser }) => {
	const id = await flowId(api, BO_FLOW);
	const grid = await onDirectusApp(browser, async (p) => {
		await openDirectusFlow(p, id);
		await headerButton(p, 'edit').click();
		await dirAddOperation(p, dirTile(p, 'Transform Payload'), '.add-reject', 'Log to Console');
		await dirSaveFlow(p);
		await expect.poll(() => countDirectusArrows(p)).toEqual({ resolve: 3, reject: 2 });
		return readDirectusGrid(p);
	});

	await signIn(page);
	await openBackofficeFlow(page, id);
	expect(cells(await readGrid(page))).toEqual(cells(grid));
	await expect.poll(() => countArrows(page)).toEqual({ resolve: 3, reject: 2 });
});

test('(3) a flow and 2 operations made in the Directus app open the same in the Backoffice app (SC-002)', async ({
	page,
	browser,
}) => {
	const grid = await onDirectusApp(browser, async (p) => {
		await goto(p, '/settings/flows');
		await headerButton(p, 'add').click();
		const drawer = p.locator('.v-drawer');
		await drawer.getByPlaceholder('Name', { exact: true }).fill(DIR_FLOW);
		await drawer.getByRole('button', { name: 'arrow_forward', exact: true }).click();
		await drawer.locator('.v-fancy-select-option', { hasText: 'Manual' }).click();
		await drawer.getByRole('button', { name: 'check', exact: true }).click();
		await expect(p).toHaveURL(/\/settings\/flows\/[0-9a-f-]{36}$/, { timeout: 30_000 });
		await dirAddOperation(p, dirTile(p, 'Trigger'), '.add-resolve', 'Condition');
		await dirAddOperation(p, dirTile(p, 'Condition'), '.add-resolve', 'Log to Console');
		await dirSaveFlow(p);
		return readDirectusGrid(p);
	});

	// The flows store loads at sign-in: a flow made elsewhere shows after signing in again.
	await signIn(page);
	await openBackofficeFlow(page, await flowId(api, DIR_FLOW));
	expect(cells(await readGrid(page))).toEqual(cells(grid));
	await expect.poll(() => countArrows(page)).toEqual({ resolve: 2, reject: 0 });
});

test('(4) runs from the item page of both apps are in the Logs of both (SC-003)', async ({ page, browser }) => {
	const id = await flowId(api, BO_FLOW);
	await api.call('PATCH', `/flows/${id}`, {
		data: {
			options: {
				collections: ['bo_content'],
				location: 'item',
				requireConfirmation: true,
				fields: [{ field: 'reason', type: 'string', name: 'Reason', meta: { interface: 'input', required: true } }],
			},
		},
	});

	await onDirectusApp(browser, async (p) => {
		await goto(p, '/content/bo_content/1');
		await openSidebarSection(p, 'Flows');
		await sidebar(p)
			.getByRole('button', { name: new RegExp(BO_FLOW) })
			.click();
		await card(p).locator('input').fill('from directus');
		await card(p).getByRole('button', { name: 'Run Flow' }).click();
		await expect(p.locator('.v-card', { hasText: 'Reason' })).toHaveCount(0);
	});

	await signIn(page);
	await openItem(page, 'bo_content', 1);
	await openSidebar(page);
	await page.getByRole('button', { name: /^Flows/ }).click();
	await page
		.getByRole('complementary')
		.getByRole('button', { name: new RegExp(BO_FLOW) })
		.click();
	await page.getByRole('dialog').getByRole('textbox').fill('from backoffice');
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /Run Flow/ })
		.click();
	await expect(page.getByRole('dialog')).toHaveCount(0);

	await expect
		.poll(
			async () =>
				(
					await api.call<unknown[]>(
						'GET',
						`/revisions?filter[item][_eq]=${id}&filter[activity][action][_eq]=run&fields=id`,
					)
				).length,
		)
		.toBe(2);

	// Backoffice: two runs; one of them is the Directus app's.
	await openBackofficeFlow(page, id);
	await openSidebar(page);
	await page.getByRole('button', { name: /^Logs/ }).click();
	const runs = page.locator('[data-flow-log] button');
	await expect(runs).toHaveCount(2);
	const boTexts: string[] = [];
	for (const n of [0, 1]) {
		await runs.nth(n).click();
		// The trigger's Payload detail holds the confirmation values; it starts closed.
		const trigger = page.locator('[data-flow-log-steps] > li').first();
		await trigger.getByRole('button', { name: 'Payload' }).click();
		boTexts.push(await trigger.innerText());
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-flow-log-steps]')).toHaveCount(0);
	}
	expect(boTexts.some((text) => text.includes('from directus'))).toBe(true);

	await onDirectusApp(browser, async (p) => {
		await openDirectusFlow(p, id);
		await openSidebarSection(p, 'Logs');
		const logs = sidebar(p).locator('.log button');
		await expect(logs).toHaveCount(2);
		const texts: string[] = [];
		for (const n of [0, 1]) {
			await logs.nth(n).click();
			const drawer = p.locator('.v-drawer').last();
			await drawer.getByText('Payload', { exact: true }).first().click();
			texts.push(await drawer.innerText());
			await p.keyboard.press('Escape');
			await expect(p.locator('.v-drawer')).toHaveCount(0);
		}
		expect(texts.some((text) => text.includes('from backoffice'))).toBe(true);
	});
});

test('(5) a flow with the "Another Flow" trigger made in the Backoffice app is a Trigger Flow choice in the Directus app (SC-002)', async ({
	page,
	browser,
}) => {
	await signIn(page);
	await createInBackoffice(page, CHILD, /^Another Flow/);
	const id = await flowId(api, DIR_FLOW);

	await onDirectusApp(browser, async (p) => {
		await openDirectusFlow(p, id);
		await headerButton(p, 'edit').click();
		const log = dirTile(p, 'Log to Console');
		await log.hover();
		await log.locator('.add-resolve').click();
		const drawer = p.locator('.v-drawer').last();
		await drawer.locator('.v-fancy-select-option', { hasText: /^\s*\S*\s*Trigger Flow/ }).click();
		await field(drawer, 'Flow').locator('.v-input').first().click();
		await chooseInMenu(p, CHILD);
		await expect(field(drawer, 'Flow').locator('input')).toHaveValue(CHILD);
	});
});
