// Spec 028 (US2, FR-010, FR-012, FR-013, D-203.1, D-206): the field picker of a filter value on the Content page, the
// chip of the compared field, the bookmark that keeps `$FIELD(b)`, the keyboard path, and the item drawer without the
// picker. The collection is made per configuration through the API of the configuration. Behind proxy-directus the API
// is Directus 11.17.4, which casts the string to the number field (400, D-203): the steps run the same and the list
// request is checked for that answer.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { CONTENT_URL, e2eConfig } from './helpers/config.js';
import { openCollection, openItem, waitForTable } from './helpers/content.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const SUFFIX = e2eConfig.replace('-', '_');
const INVOICES = `bo_cmp_${SUFFIX}`;
const ORDERS = `bo_cmp_orders_${SUFFIX}`;
const DIRECTUS = e2eConfig === 'proxy-directus';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

async function drop() {
	for (const collection of [ORDERS, INVOICES]) {
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
			collection: INVOICES,
			schema: {},
			meta: { display_template: '{{title}}' },
			fields: [
				id,
				{ field: 'title', type: 'string', meta: { interface: 'input' } },
				{ field: 'total', type: 'integer', meta: { interface: 'input' } },
				{ field: 'paid_amount', type: 'integer', meta: { interface: 'input' } },
				{ field: 'published_at', type: 'timestamp', meta: { interface: 'datetime' } },
				{ field: 'updated_at', type: 'timestamp', meta: { interface: 'datetime' } },
			],
		},
	});

	await api.call('POST', `/items/${INVOICES}`, {
		data: [
			// prettier-ignore
			{ title: 'cmp-open', total: 100, paid_amount: 60, published_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
			// prettier-ignore
			{ title: 'cmp-settled', total: 60, paid_amount: 60, published_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
			// prettier-ignore
			{ title: 'cmp-overpaid', total: 50, paid_amount: 60, published_at: '2026-03-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
		],
	});

	await api.call('POST', '/collections', {
		data: {
			collection: ORDERS,
			schema: {},
			meta: {},
			fields: [id, { field: 'invoice', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } }],
		},
	});

	await api.call('POST', '/relations', {
		data: { collection: ORDERS, field: 'invoice', related_collection: INVOICES, schema: {}, meta: {} },
	});

	await api.call('POST', '/utils/cache/clear?system');
});

// Behind proxy-directus the first test stops at the 400 with the rule in the preset; the next test starts clean.
test.beforeEach(async () => {
	const presets = await api.call<{ id: number }[]>('GET', `/presets?filter[collection][_in]=${INVOICES},${ORDERS}`);
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

/** The list request whose filter compares with field b, and its answer. */
function comparedResponse(page: Page, field: string) {
	return page.waitForResponse(
		(r) => r.url().includes(`/items/${INVOICES}`) && decodeURIComponent(r.url()).includes(`$FIELD(${field})`),
	);
}

/** Add Filter → Total → operator Greater than, in the open filter popover (or drawer). */
async function addTotalGreaterThan(scope: Page | ReturnType<Page['getByRole']>, page: Page) {
	await scope.getByRole('button', { name: 'Add Filter' }).click();
	await page
		.getByRole('treeitem', { name: /Total$/ })
		.first()
		.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Equals', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Greater than', exact: true }).click();
}

test('Content: pick a field for the value, see the chip, keep it in the bookmark, go back to a value', async ({
	page,
}) => {
	await signIn(page);
	await openCollection(page, INVOICES);
	await waitForTable(page);
	await expect(rows(page)).toHaveCount(3);

	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await addTotalGreaterThan(page, page);

	const saved = page.waitForRequest(
		(r) =>
			['POST', 'PATCH'].includes(r.method()) &&
			/\/presets(\/\d+)?$/.test(r.url()) &&
			JSON.stringify(r.postDataJSON()?.filter ?? '').includes('$FIELD('),
	);
	const answered = comparedResponse(page, 'paid_amount');

	await page.getByRole('button', { name: 'Compare with a field' }).click();
	await page.getByRole('menuitem', { name: 'Paid Amount', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Compared with Paid Amount' })).toBeVisible();

	// FR-010: the value is stored as it is in directus_presets.
	expect(JSON.stringify((await saved).postDataJSON().filter)).toContain('"total":{"_gt":"$FIELD(paid_amount)"}');
	const response = await answered;

	if (DIRECTUS) {
		// D-203: Directus casts the string to the number field; the layout shows the API error like the DR app
		// (D-203.1), with the button that resets the preset.
		expect(response.status()).toBe(400);
		await expect(page.getByRole('main')).toContainText('INVALID_QUERY');
		await expect(page.getByRole('button', { name: 'Reset Page Preferences' })).toBeVisible();
		return;
	}

	expect(response.status()).toBe(200);
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).first()).toContainText('cmp-open');

	// The bookmark keeps the rule after a reload (FR-010, SC-005).
	await page.keyboard.press('Escape');
	await api.call('POST', '/utils/cache/clear');
	await page.reload();
	await waitForTable(page);
	await expect(rows(page)).toHaveCount(1);

	// The chip → "Enter a value" → a typed value.
	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await page.getByRole('button', { name: 'Compared with Paid Amount' }).click();
	await page.getByRole('menuitem', { name: 'Enter a value', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Compared with Paid Amount' })).toHaveCount(0);
	await page.getByRole('dialog').getByRole('textbox', { name: 'Value' }).fill('55');
	await expect(rows(page)).toHaveCount(2);

	// Back to no filter for the next run.
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).first().click();
	await expect(rows(page)).toHaveCount(3);
});

test('Content: the field picker with the keyboard only; a timestamp compares with a timestamp', async ({ page }) => {
	await signIn(page);
	await openCollection(page, INVOICES);
	await waitForTable(page);

	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await page.getByRole('button', { name: 'Add Filter' }).click();
	// A date field row has the functions toggle in front of its name: select it with Enter, not a click in the middle.
	await page
		.getByRole('treeitem', { name: /Updated At$/ })
		.first()
		.focus();
	await page.keyboard.press('Enter');
	// DR 11.17.4 has no `timestamp` case in getFilterOperatorsForType: the rule opens with the default list (Contains first).
	await page.getByRole('dialog').getByRole('button', { name: 'Contains', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Greater than', exact: true }).click();

	const answered = comparedResponse(page, 'published_at');
	await page.getByRole('button', { name: 'Compare with a field' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menu')).toBeVisible();
	// The menu lists the timestamp fields only: End is Published At.
	await page.keyboard.press('End');
	await expect(page.getByRole('menuitem', { name: 'Published At', exact: true })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Compared with Published At' })).toBeFocused();

	const response = await answered;

	if (DIRECTUS) {
		// D-203: Postgres rejects the string as a timestamp (500).
		expect([400, 500]).toContain(response.status());
		return;
	}

	expect(response.status()).toBe(200);
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).first()).toContainText('cmp-open');

	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).first().click();
	await expect(rows(page)).toHaveCount(3);
});

test('item drawer: no field picker, the value stays a typed one (FR-013, D-206)', async ({ page }) => {
	await signIn(page);
	await openItem(page, ORDERS, '+');

	await page.getByRole('button', { name: /Select an item/ }).click();
	const drawer = page.getByRole('dialog').filter({ has: page.getByRole('table') });
	await expect(drawer.getByRole('table')).toBeVisible();

	await drawer.getByRole('button', { name: 'Filter', exact: true }).click();
	await addTotalGreaterThan(page, page);
	await expect(page.getByRole('button', { name: 'Compare with a field' })).toHaveCount(0);
	await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Value' }).last()).toBeVisible();
});
