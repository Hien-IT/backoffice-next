// Spec 020 US3 and US4 (T147, T162; FR-060 to FR-074): the app extensions of the fixture set, built for Directus
// 11.17.4 and loaded from /extensions/sources/index.js without a rebuild, run in the new app. Interface (v-input, v-menu,
// v-select, useApi, useStores) saves its value; display draws in the table; layout (useItems, v-table) renders from a
// preset; panel (query + v-progress-circular) counts in a dashboard; operation (app side) shows its overview in the flow
// editor; module renders in private-view with its dialog. Runs in the three configurations.
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { AdminApi } from './helpers/api.js';
import { createTempDashboard, deleteTempDashboards, tempDashboardName } from './helpers/insights.js';
import { createTempFlow, deleteTempFlows, tempFlowName } from './helpers/flows.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.describe.configure({ mode: 'serial' });

const COLLECTION = 'bo_ext_app';
const SPEC = 'extensions-app';

let api: AdminApi;
let items: { id: number }[];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const collections = await api.call<{ collection: string }[]>('GET', '/collections?limit=-1');

	if (!collections.some(({ collection }) => collection === COLLECTION)) {
		await api.call('POST', '/collections', {
			data: {
				collection: COLLECTION,
				schema: {},
				meta: { icon: 'extension' },
				fields: [
					{
						field: 'id',
						type: 'integer',
						schema: { is_primary_key: true, has_auto_increment: true },
						meta: { hidden: true },
					},
					{
						field: 'color',
						type: 'string',
						meta: { interface: 'parity-interface-color', display: 'parity-display-badge' },
					},
					{ field: 'title', type: 'string', meta: { interface: 'input' } },
				],
			},
		});
	}

	await deleteWhere(`/items/${COLLECTION}`, `filter[title][_starts_with]=${DATA_PREFIX}`);
	await deleteWhere('/presets', `filter[collection][_eq]=${COLLECTION}&filter[bookmark][_null]=true`);
	items = await api.call<{ id: number }[]>('POST', `/items/${COLLECTION}`, {
		data: [
			{ color: 'red', title: `${DATA_PREFIX}-one` },
			{ color: 'blue', title: `${DATA_PREFIX}-two` },
		],
	});
});

test.afterAll(async () => {
	await api.call('DELETE', `/items/${COLLECTION}`, { data: items.map(({ id }) => id) });
	await deleteWhere('/presets', `filter[collection][_eq]=${COLLECTION}&filter[bookmark][_null]=true`);
	await deleteTempDashboards(api, SPEC);
	await deleteTempFlows(api, SPEC);
});

/** Deletes the rows of `path` that match `query` (DELETE takes keys, not a filter in the query string). */
async function deleteWhere(path: string, query: string) {
	const rows = await api.call<{ id: number | string }[]>('GET', `${path}?${query}&fields=id&limit=-1`);
	if (rows.length > 0) await api.call('DELETE', path, { data: rows.map(({ id }) => id) });
}

async function signIn(page: import('@playwright/test').Page, path: string) {
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin${path}`);
}

test('interface: the preset menu and the select set the value; Save sends it (US3-1)', async ({ page }) => {
	await signIn(page, `/content/${COLLECTION}/${items[0]!.id}`);

	// v-input binds its attributes to the <input> (directus/app/src/components/v-input.vue).
	const input = page.getByTestId('parity-color-input');
	await expect(input).toHaveValue('red');
	// useApi (GET /server/ping) and useStores (the current user) of the extension.
	await expect(page.getByTestId('parity-color-info')).toHaveText(`${ADMIN.email}: pong`);

	await page.getByTestId('parity-color-menu').click();
	await page
		.getByRole('menuitem', { name: 'green' })
		.or(page.getByText('green', { exact: true }))
		.first()
		.click();
	await expect(input).toHaveValue('green');

	const save = page.waitForRequest(
		(request) => request.method() === 'PATCH' && request.url().includes(`/items/${COLLECTION}/${items[0]!.id}`),
	);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	expect((await save).postDataJSON()).toEqual({ color: 'green' });
	await expect
		.poll(async () => (await api.call<{ color: string }>('GET', `/items/${COLLECTION}/${items[0]!.id}`)).color)
		.toBe('green');
});

test('display: the table draws the values through the display extension (US3-2)', async ({ page }) => {
	await signIn(page, `/content/${COLLECTION}`);

	const row = page.getByRole('row').filter({ hasText: `${DATA_PREFIX}-two` });
	await expect(row.getByTestId('parity-badge')).toHaveText(/blue/);
});

test('layout: a preset with the layout extension renders its v-table from useItems (US3-3)', async ({ page }) => {
	await api.call('POST', '/presets', {
		data: {
			collection: COLLECTION,
			layout: 'parity-layout-grid',
			layout_options: { 'parity-layout-grid': { limit: 10 } },
		},
	});
	await signIn(page, `/content/${COLLECTION}`);

	const grid = page.getByTestId('parity-grid');
	await expect(grid).toBeVisible();
	await expect(grid.getByRole('row').filter({ hasText: `${DATA_PREFIX}-two` })).toHaveCount(1);
});

test('panel: the counter panel shows the count of its query (US3-4)', async ({ page }) => {
	const id = await createTempDashboard(api, tempDashboardName(SPEC, 1), [
		{
			type: 'parity-panel-counter',
			name: 'Counter',
			position_x: 1,
			position_y: 1,
			width: 8,
			height: 6,
			show_header: true,
			options: { collection: COLLECTION },
		},
	]);
	const count = (await api.call<unknown[]>('GET', `/items/${COLLECTION}?fields=id&limit=-1`)).length;

	await signIn(page, `/insights/${id}`);
	await expect(page.getByTestId('parity-counter')).toHaveText(String(count));
});

test('operation: the app side of the operation shows its overview in the flow editor (US3-5)', async ({ page }) => {
	const flow = await createTempFlow(api, tempFlowName(SPEC, 1));
	const operation = await api.call<{ id: string }>('POST', '/operations?fields=id', {
		data: {
			flow,
			key: 'notify',
			name: 'Notify',
			type: 'parity-operation-slack',
			position_x: 19,
			position_y: 1,
			options: { text: 'hello from the fixture' },
		},
	});
	await api.call('PATCH', `/flows/${flow}`, { data: { operation: operation.id } });

	await signIn(page, `/settings/flows/${flow}`);
	await expect(page.getByText('hello from the fixture')).toBeVisible();
});

test('module: its route renders in private-view; the v-dialog opens and closes (US4)', async ({ page }) => {
	await signIn(page, '/parity-module-report');

	await expect(page.getByRole('heading', { level: 1, name: 'Parity Report' })).toBeVisible();
	await expect(page.getByTestId('parity-report')).toContainText('The report module is a parity fixture.');

	await page.getByTestId('parity-report-open').click();
	await expect(page.getByRole('dialog')).toContainText('Parity dialog');
	await page.getByTestId('parity-report-close').click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
});
