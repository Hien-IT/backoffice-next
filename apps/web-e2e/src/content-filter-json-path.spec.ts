// Spec 023 (US2, US3, FR-013 to FR-017, D-184.1, D-187): the "JSON path" entry of a json field in the Content filter
// and in the item drawer. The collections are made per configuration through the API of the configuration, so the
// fixture set bo_* and its snapshot stay as they are. Behind proxy-directus the API is Directus 11.17.4, which refuses
// json(...) filter keys (403, D-184): the steps run the same and the list request is checked for that answer.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { CONTENT_URL, e2eConfig } from './helpers/config.js';
import { openCollection, openItem, waitForTable } from './helpers/content.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const SUFFIX = e2eConfig.replace('-', '_');
const PAYMENTS = `bo_json_${SUFFIX}`;
const ORDERS = `bo_json_orders_${SUFFIX}`;
const DIRECTUS = e2eConfig === 'proxy-directus';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

async function drop() {
	for (const collection of [ORDERS, PAYMENTS]) {
		await api.call('DELETE', `/collections/${collection}`).catch(() => undefined);
	}
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await drop();

	const id = {
		field: 'id',
		type: 'integer',
		meta: { hidden: true },
		schema: { is_primary_key: true, has_auto_increment: true },
	};

	await api.call('POST', '/collections', {
		data: {
			collection: PAYMENTS,
			schema: {},
			meta: { display_template: '{{title}}' },
			fields: [
				id,
				{ field: 'title', type: 'string', meta: { interface: 'input' } },
				{ field: 'payload', type: 'json', meta: { interface: 'input-code', special: ['cast-json'] } },
			],
		},
	});

	await api.call('POST', `/items/${PAYMENTS}`, {
		data: [
			{ title: 'pay-6000', payload: { Amount: 6000, Currency: 'VND', items: [{ sku: 'sku-1' }] } },
			{ title: 'pay-7000', payload: { Amount: 7000, Currency: 'USD', items: [{ sku: 'sku-2' }, { sku: 'sku-3' }] } },
			{ title: 'pay-text', payload: { Amount: '6000' } },
		],
	});

	await api.call('POST', '/collections', {
		data: {
			collection: ORDERS,
			schema: {},
			meta: {},
			fields: [id, { field: 'payment', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } }],
		},
	});

	await api.call('POST', '/relations', {
		data: { collection: ORDERS, field: 'payment', related_collection: PAYMENTS, schema: {}, meta: {} },
	});

	await api.call('POST', '/utils/cache/clear?system');
});

// Behind proxy-directus the first test stops at the 403 with the json rule in the preset; the drawer reads it too.
test.beforeEach(async () => {
	const presets = await api.call<{ id: number }[]>('GET', `/presets?filter[collection][_in]=${PAYMENTS},${ORDERS}`);
	if (presets.length) await api.call('DELETE', '/presets', { data: presets.map((p) => p.id) });
});

test.afterAll(async () => {
	await drop();
});

async function signIn(page: Page) {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page);
	await expect(page).toHaveURL(CONTENT_URL);
}

const rows = (page: Page) => page.getByRole('main').getByRole('table').locator('tbody tr');

/** Add Filter → <field> → JSON path, in the open filter popover (or drawer). */
async function chooseJsonPath(scope: Page | ReturnType<Page['getByRole']>, page: Page, field: string) {
	await scope.getByRole('button', { name: 'Add Filter' }).click();
	const row = page.getByRole('treeitem', { name: new RegExp(`${field}$`) }).first();
	await row.focus();
	await page.keyboard.press('ArrowRight');
	await page.getByRole('treeitem', { name: `JSON path (${field})` }).click();
}

/** The list request with a json(...) key in its filter, and its answer. */
function jsonPathResponse(page: Page, collection: string) {
	return page.waitForResponse(
		(r) => r.url().includes(`/items/${collection}`) && decodeURIComponent(r.url()).includes('json(payload'),
	);
}

test('Content: add a JSON path rule with the keyboard, refuse a wrong path, keep it in the preset, edit it', async ({
	page,
}) => {
	await signIn(page);
	await openCollection(page, PAYMENTS);
	await waitForTable(page);
	await expect(rows(page)).toHaveCount(3);

	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await chooseJsonPath(page, page, 'Payload');

	const path = page.getByPlaceholder('Amount, items[*].sku');
	await expect(path).toBeFocused();

	// A wrong path: inline error, nothing sent.
	let listCalls = 0;
	page.on('request', (r) => {
		if (r.url().includes(`/items/${PAYMENTS}`) && decodeURIComponent(r.url()).includes('json(')) listCalls++;
	});
	await path.fill('items[');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('alert')).toContainText('Invalid JSON path');
	expect(listCalls).toBe(0);

	// Amount, Number, keyboard only.
	await path.fill('Amount');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('combobox', { name: 'Type' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('option', { name: 'Text' })).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('option', { name: 'Number' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('combobox', { name: 'Type' })).toContainText('Number');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('button', { name: 'Payload › Amount (Number)', exact: true })).toBeVisible();

	const saved = page.waitForRequest(
		(r) =>
			// The first preset of a new collection is a POST, later saves a PATCH.
			['POST', 'PATCH'].includes(r.method()) &&
			/\/presets(\/\d+)?$/.test(r.url()) &&
			JSON.stringify(r.postDataJSON()?.filter ?? '').includes('json('),
	);
	const answered = jsonPathResponse(page, PAYMENTS);
	await page.getByRole('dialog').getByRole('textbox').last().fill('6000');

	// FR-016: the key is stored as it is in directus_presets.
	expect(JSON.stringify((await saved).postDataJSON().filter)).toContain(
		'"json(payload, Amount, number)":{"_eq":"6000"}',
	);
	const response = await answered;

	if (DIRECTUS) {
		// D-184: Directus reads "payload, Amount, number" as a field name; the layout shows the API error like the DR
		// app (D-184.1), with the button that resets the preset.
		expect(response.status()).toBe(403);
		await expect(page.getByRole('main')).toContainText('FORBIDDEN');
		await expect(page.getByRole('button', { name: 'Reset Page Preferences' })).toBeVisible();
		return;
	}

	expect(response.status()).toBe(200);
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).first()).toContainText('pay-6000');

	// The preset keeps the rule after a reload (FR-016, SC-005).
	await page.keyboard.press('Escape');
	// A reload reads /presets again: the parity APIs cache it (CACHE_ENABLED).
	await api.call('POST', '/utils/cache/clear');
	await page.reload();
	await waitForTable(page);
	await expect(rows(page)).toHaveCount(1);

	// Edit: path Currency, type Text (the operator goes back to Contains, the value is cleared).
	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await page.getByRole('button', { name: 'Payload › Amount (Number)', exact: true }).click();
	await expect(page.getByPlaceholder('Amount, items[*].sku')).toHaveValue('Amount');
	await page.getByPlaceholder('Amount, items[*].sku').fill('Currency');
	await page.getByRole('combobox', { name: 'Type' }).click();
	await page.getByRole('option', { name: 'Text' }).click();
	await page.getByRole('button', { name: 'Apply' }).click();

	await expect(page.getByRole('button', { name: 'Payload › Currency (Text)', exact: true })).toBeVisible();
	await page.getByRole('dialog').getByRole('textbox').last().fill('US');
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).first()).toContainText('pay-7000');

	// Back to no filter for the next run.
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).first().click();
	await expect(rows(page)).toHaveCount(3);
});

test('item drawer: the same JSON path entry filters the items to pick, any array element (US3)', async ({ page }) => {
	await signIn(page);
	await openItem(page, ORDERS, '+');

	await page.getByRole('button', { name: /Select an item/ }).click();
	const drawer = page.getByRole('dialog').filter({ has: page.getByRole('table') });
	await expect(drawer.getByRole('table')).toBeVisible();

	await drawer.getByRole('button', { name: 'Filter', exact: true }).click();
	await chooseJsonPath(page, page, 'Payload');
	await page.getByPlaceholder('Amount, items[*].sku').fill('items[*].sku');
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page.getByRole('button', { name: 'Payload › items[*].sku (Text)', exact: true })).toBeVisible();

	const answered = jsonPathResponse(page, PAYMENTS);
	await page.getByRole('dialog').getByRole('textbox').last().fill('sku-3');
	const response = await answered;

	if (DIRECTUS) {
		expect(response.status()).toBe(403);
		return;
	}

	expect(response.status()).toBe(200);
	await expect(drawer.locator('tbody tr')).toHaveCount(1);
	await expect(drawer.locator('tbody tr').first()).toContainText('pay-7000');
});

test('Settings > Policies: the item permission filter offers no JSON path (FR-015, D-185)', async ({ page }) => {
	const policy = await api.call<{ id: string }>('POST', '/policies', {
		data: { name: `bo-json-e2e-${SUFFIX}`, app_access: false, admin_access: false },
	});

	try {
		await signIn(page);
		await page.goto(`/admin/settings/policies/${policy.id}`);
		const matrix = page.locator('[data-permissions-matrix]');
		await expect(matrix).toBeVisible();

		await page.getByRole('button', { name: 'Add Collection' }).click();
		await page.getByRole('menuitem', { name: PAYMENTS, exact: true }).click();
		const row = matrix.locator(`tr[data-collection="${PAYMENTS}"]`);
		await row.getByRole('button', { name: 'No Read Access' }).click();
		await page.getByRole('menuitem', { name: 'Use Custom' }).click();

		const drawer = page.getByRole('dialog', { name: new RegExp(`${PAYMENTS} -> Read`) });
		await drawer.getByRole('tab', { name: /Item Permissions/ }).click();
		await drawer.getByRole('button', { name: 'Add Filter' }).click();
		// The permission filter lists raw field names (DR rawFieldNames).
		await page
			.getByRole('treeitem', { name: /payload$/ })
			.first()
			.focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('treeitem', { name: 'Count (payload)' })).toBeVisible();
		await expect(page.getByRole('treeitem', { name: /^JSON path/ })).toHaveCount(0);
	} finally {
		await api.call('DELETE', `/policies/${policy.id}`);
	}
});

test('Files and Users: json fields keep Count and offer no JSON path (FR-015)', async ({ page }) => {
	await signIn(page);

	for (const url of ['/admin/files', '/admin/users']) {
		await page.goto(url);
		await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
		await page.getByRole('button', { name: 'Filter', exact: true }).click();
		await page.getByRole('button', { name: 'Add Filter' }).click();
		const tags = page.getByRole('treeitem', { name: /Tags$/ }).first();
		await tags.focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('treeitem', { name: 'Count (Tags)' })).toBeVisible();
		await expect(page.getByRole('treeitem', { name: 'JSON path (Tags)' })).toHaveCount(0);
		await page.keyboard.press('Escape');
		await page.keyboard.press('Escape');
	}
});
