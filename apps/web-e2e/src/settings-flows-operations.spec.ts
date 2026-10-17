// Feature 017 US3 (T062; US3-1 to US3-5, FR-040 to FR-045, data-model §5): the operation drawer in the three
// configurations. Each of the 15 operations of bo_all_ops opens with the option fields of its Directus definition for
// its stored options (the visible `data-field`s, in order); `mail` shows the D-106 notice; the key must be unique in the
// flow; an unknown type (bo_orphan) shows its notice; on a temporary flow, "+" twice before Save nests the second new
// operation under the first (US2-12). No test runs bo_all_ops (CHK007).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { createTempFlow, deleteTempFlows, flowId, FLOWS, panel, tempFlowName } from './helpers/flows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

let api: AdminApi;

test.describe.configure({ mode: 'serial' });

type Operation = { id: string; key: string; resolve: string | null; position_x: number; position_y: number };

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await deleteTempFlows(api, 'operations');
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await deleteTempFlows(api, 'operations');
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

const operationsOf = async (id: string) =>
	api.call<Operation[]>(
		'GET',
		`/operations?filter[flow][_eq]=${id}&fields=id,key,resolve,position_x,position_y&limit=-1`,
	);

// data-model §5, for the options stored by the seed (json-web-token `sign`, mail `markdown`, trigger `serial`).
const FIELDS: Record<string, string[]> = {
	condition: ['filter'],
	exec: ['code'],
	item_create: ['collection', 'permissions', 'emitEvents', 'payload'],
	item_delete: ['collection', 'permissions', 'emitEvents', 'key', 'query'],
	item_read: ['permissions', 'collection', 'key', 'query', 'emitEvents'],
	item_update: ['collection', 'permissions', 'emitEvents', 'key', 'payload', 'query'],
	json_web_token: ['operation', 'payload', 'secret', 'options'],
	log: ['message'],
	mail: ['to', 'subject', 'cc', 'bcc', 'replyTo', 'type', 'body'],
	notification: ['recipient', 'permissions', 'subject', 'message', 'collection', 'item'],
	request: ['method', 'url', 'headers', 'body'],
	sleep: ['milliseconds'],
	throw_error: ['code', 'status', 'message'],
	transform: ['json'],
	trigger: ['flow', 'iterationMode', 'payload'],
};

test('the 15 operations of bo_all_ops: the drawer shows the option fields of their type (US3-1 to US3-3)', async ({
	page,
}) => {
	const id = await flowId(api, FLOWS.all);
	const operations = await operationsOf(id);
	await signIn(page);

	for (const [key, fields] of Object.entries(FIELDS)) {
		const operation = operations.find((o) => o.key === key)!;
		await page.goto(`/admin/settings/flows/${id}/${operation.id}`);
		const drawer = page.getByRole('dialog');
		await expect(drawer, key).toContainText('Edit Operation');
		await expect
			.poll(() => drawer.locator('[data-field]').evaluateAll((els) => els.map((el) => el.getAttribute('data-field'))), {
				message: key,
			})
			.toEqual(fields);

		if (key === 'mail') await expect(drawer).toContainText('Backoffice does not send email.');
		else await expect(drawer).not.toContainText('Backoffice does not send email.');
	}
});

test('the key must be unique in the flow; an unknown type shows its notice (US3-1, US3-5)', async ({ page }) => {
	const all = await flowId(api, FLOWS.all);
	const log = (await operationsOf(all)).find((o) => o.key === 'log')!;
	await signIn(page);
	await page.goto(`/admin/settings/flows/${all}/${log.id}`);

	const key = page.getByRole('dialog').getByRole('textbox', { name: 'Key' });
	await key.fill('transform');
	await expect(page.getByRole('dialog')).toContainText('Operation keys must be unique in a Flow');
	await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
	await page.keyboard.press('Escape');

	const orphan = await flowId(api, FLOWS.orphan);
	const unknown = (await operationsOf(orphan)).find((o) => o.key === 'unknown')!;
	await page.goto(`/admin/settings/flows/${orphan}/${unknown.id}`);
	await expect(page.getByRole('dialog')).toContainText('bo-unknown');
	await expect(page.getByRole('dialog').getByRole('button', { name: 'Reset Interface' })).toBeVisible();
});

test('"+" twice before Save: the second operation nests under the first (US2-12)', async ({ page }) => {
	const id = await createTempFlow(api, tempFlowName('operations', 1));
	await signIn(page);
	await page.goto(`/admin/settings/flows/${id}`);
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

	for (const [index, name] of ['First step', 'Second step'].entries()) {
		const parent = index === 0 ? '$trigger' : 'first_step';
		await panel(page, parent).hover();
		await panel(page, parent).locator('[data-hint="resolve"]').click();
		const drawer = page.getByRole('dialog');
		await drawer.getByRole('textbox', { name: 'Name' }).fill(name);
		await drawer.getByRole('button', { name: /^Log to Console/ }).click();
		await page.getByRole('button', { name: 'Done' }).click();
		await expect(panel(page, name.toLowerCase().replace(' ', '_'))).toBeVisible();
	}

	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Edit Flow' })).toBeVisible();
	const operations = await operationsOf(id);
	const first = operations.find((o) => o.key === 'first_step')!;
	const second = operations.find((o) => o.key === 'second_step')!;
	expect(first).toMatchObject({ position_x: 19, position_y: 1, resolve: second.id });
	expect(second).toMatchObject({ position_x: 37, position_y: 1 });
});
