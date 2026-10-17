// Feature 017 US2 (T051; US2-1 to US2-12, FR-020 to FR-032): the flow canvas in the three configurations. bo_all_ops in
// view mode (16 panels at their cells, 13 resolve and 2 reject arrows); on a temporary flow (condition -> log ->
// transform, reject -> throw-error) the edit mode: drag a panel, "+" then Done, relink a reject arrow, duplicate,
// delete, Save checked through the API, Clear Changes, the unsaved-changes guard, Ctrl/Cmd+S and Delete Flow. Every flow
// a test creates is named `${DATA_PREFIX}-editor-<n>` and deleted after the file; no test runs bo_all_ops (CHK007) and no
// test makes cyclic data (R-48). Dragging is pointer only, as Directus (FR-106).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import {
	countArrows,
	createTempFlow,
	deleteTempFlows,
	dragPanel,
	flowId,
	FLOWS,
	linkHandle,
	panel,
	readGrid,
	tempFlowName,
} from './helpers/flows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

type Operation = {
	id: string;
	key: string;
	position_x: number;
	position_y: number;
	resolve: string | null;
	reject: string | null;
};

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempFlows(api, 'editor');
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await deleteTempFlows(api, 'editor');
});

/** A manual flow with condition -> log -> transform and condition -> (reject) throw_error, saved as the editor does. */
async function tempFlow(n: number): Promise<string> {
	const id = await createTempFlow(api, tempFlowName('editor', n));
	const node = (key: string, type: string, x: number, y: number, links: Record<string, unknown> = {}) => ({
		flow: id,
		name: key,
		key,
		type,
		position_x: x,
		position_y: y,
		options: {},
		...links,
	});
	await api.call('PATCH', `/flows/${id}`, {
		data: {
			operations: { create: [], update: [], delete: [] },
			operation: node('condition', 'condition', 19, 1, {
				resolve: node('log', 'log', 37, 1, { resolve: node('transform', 'transform', 55, 1) }),
				reject: node('throw_error', 'throw-error', 37, 17),
			}),
		},
	});
	return id;
}

const operations = async (id: string) =>
	api.call<Operation[]>(
		'GET',
		`/operations?filter[flow][_eq]=${id}&fields=id,key,position_x,position_y,resolve,reject&limit=-1`,
	);
const byKey = async (id: string, key: string) => (await operations(id)).find((o) => o.key === key);

async function openFlow(page: Page, id: string) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	await page.goto(`/admin/settings/flows/${id}`);
	await expect(panel(page, '$trigger')).toBeVisible();
}

const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true }).click();
const edit = (page: Page) => page.getByRole('button', { name: 'Edit Flow' }).click();

async function tileMenu(page: Page, key: string, entry: string) {
	await panel(page, key)
		.getByRole('button', { name: /^Options for/ })
		.click();
	await page.getByRole('menuitem', { name: entry }).click();
}

test('view mode: bo_all_ops, every panel at its cell and the arrows (US2-1, US2-2)', async ({ page }) => {
	await openFlow(page, await flowId(api, FLOWS.all));

	const grid = await readGrid(page);
	expect(grid).toHaveLength(16);
	expect(grid.find((p) => p.key === 'condition')).toEqual({ key: 'condition', x: 19, y: 1 });
	expect(grid.find((p) => p.key === 'throw_error')).toEqual({ key: 'throw_error', x: 37, y: 17 });
	expect(await countArrows(page)).toEqual({ resolve: 13, reject: 2 });
	await expect(page.getByRole('button', { name: 'Edit Flow' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
});

test('drag a panel, add an operation with "+", Save: the API has the new cells and the new operation (US2-4, US2-5, US2-9)', async ({
	page,
}) => {
	const id = await tempFlow(1);
	await openFlow(page, id);
	await edit(page);
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();

	await dragPanel(page, 'transform', { dx: 3, dy: 2 });
	await expect(panel(page, 'transform')).toHaveAttribute('data-pos-x', '58');
	await expect(panel(page, 'transform')).toHaveAttribute('data-pos-y', '3');

	await panel(page, 'throw_error').hover();
	await panel(page, 'throw_error').locator('[data-hint="resolve"]').click();
	const drawer = page.getByRole('dialog');
	await expect(drawer).toContainText('Create Operation');
	await drawer.getByRole('textbox', { name: 'Name' }).fill('After error');
	await drawer.getByRole('button', { name: /^Log to Console/ }).click();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(panel(page, 'after_error')).toHaveAttribute('data-pos-x', '55');
	await expect(panel(page, 'after_error')).toHaveAttribute('data-pos-y', '17');

	await save(page);
	await expect(page.getByRole('button', { name: 'Edit Flow' })).toBeFocused();
	await expect.poll(async () => (await byKey(id, 'transform'))?.position_x).toBe(58);
	const added = await byKey(id, 'after_error');
	expect(added).toMatchObject({ position_x: 55, position_y: 17 });
	expect((await byKey(id, 'throw_error'))!.resolve).toBe(added!.id);
});

test('relink: the reject of condition dropped on transform; detach; duplicate; delete; Save (US2-6, US2-7)', async ({
	page,
}) => {
	const id = await tempFlow(2);
	await openFlow(page, id);
	await edit(page);

	await linkHandle(page, 'condition', 'reject', 'transform');
	await linkHandle(page, 'log', 'resolve', null);
	await tileMenu(page, 'throw_error', 'Duplicate');
	await expect(page.locator('[data-panel-key^="throw_error_"]')).toHaveAttribute('data-pos-x', '39');
	await tileMenu(page, 'throw_error', 'Delete');
	await expect(panel(page, 'throw_error')).toHaveCount(0);

	await save(page);
	await expect(page.getByRole('button', { name: 'Edit Flow' })).toBeVisible();
	await expect
		.poll(async () => (await operations(id)).map((o) => o.key.replace(/_[a-z]{5}$/, '_*')).sort())
		.toEqual(['condition', 'log', 'throw_error_*', 'transform']);
	const transform = await byKey(id, 'transform');
	expect((await byKey(id, 'condition'))!.reject).toBe(transform!.id);
	expect((await byKey(id, 'log'))!.resolve).toBeNull();
});

test('Clear Changes asks with Keep Editing first; the guard asks when leaving; Ctrl/Cmd+S saves (US2-9, US2-10)', async ({
	page,
}) => {
	const id = await tempFlow(3);
	await openFlow(page, id);
	await edit(page);
	await dragPanel(page, 'log', { dx: 0, dy: 3 });

	await page.getByRole('button', { name: 'Clear Changes' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('button').first()).toHaveText('Keep Editing');
	await dialog.getByRole('button', { name: 'Keep Editing' }).click();

	await page.getByRole('link', { name: 'Back' }).click();
	await expect(page.getByRole('dialog')).toContainText('Unsaved Changes');
	await page.getByRole('dialog').getByRole('button', { name: 'Keep Editing' }).click();

	await page.keyboard.press('ControlOrMeta+s');
	await expect(page.getByRole('button', { name: 'Edit Flow' })).toBeVisible();
	await expect.poll(async () => (await byKey(id, 'log'))?.position_y).toBe(4);
});

test('Delete Flow: the dialog, then the overview and the flow is gone (US2-11)', async ({ page }) => {
	const id = await tempFlow(4);
	await openFlow(page, id);
	await page.getByRole('button', { name: 'Delete Flow' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/settings\/flows$/);
	await expect
		.poll(async () => (await api.call<unknown[]>('GET', `/flows?filter[id][_eq]=${id}&fields=id`)).length)
		.toBe(0);
});
