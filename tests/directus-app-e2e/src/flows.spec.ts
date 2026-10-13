// Feature 009 (spec FR-063, contracts/parity.md §5): the Flows module of the Directus app through the proxy, where
// /flows and /operations go to the new app, writes the same rows as Directus alone: create a manual flow on a
// collection, add a Transform and a Log operation, save, run it from an item and from a selection of two items, read
// the two runs in the Logs sidebar, set the flow inactive (the item no longer offers it), delete it.
import { expect, type Locator, type Page, test } from '@playwright/test';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { ADMIN } from './helpers/login.js';
import { bothRuns, DIRECTUS_URL } from './helpers/scenario.js';

const COLLECTION = 'e2e_flows_posts';

async function admin(method: string, path: string, body?: unknown) {
	const login = await fetch(`${DIRECTUS_URL}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	const token = ((await login.json()) as any).data.access_token as string;

	return fetch(`${DIRECTUS_URL}${path}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

let keys: number[];

test.beforeAll(async () => {
	await admin('DELETE', `/collections/${COLLECTION}`);
	const created = await admin('POST', '/collections', {
		collection: COLLECTION,
		schema: {},
		meta: { icon: 'article' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string', meta: { interface: 'input' } },
		],
	});
	expect(created.status).toBe(200);
	const items = await admin('POST', `/items/${COLLECTION}`, [{ title: 'first' }, { title: 'second' }]);
	keys = ((await items.json()) as any).data.map((item: { id: number }) => item.id);
});

test.afterAll(async () => {
	await admin('DELETE', `/collections/${COLLECTION}`);
	await closeHostDb();
});

const call = (page: Page, method: string, path: RegExp) =>
	page.waitForResponse((r) => path.test(new URL(r.url()).pathname) && r.request().method() === method);

/** Adds an operation after `panel` in edit mode (the hint of its resolve handle), through the operation drawer. */
async function addOperation(
	page: Page,
	panel: string,
	type: string,
	key: string,
	fill: (drawer: Locator) => Promise<void>,
) {
	const block = page
		.locator('.block-container')
		.filter({ has: page.locator('.name', { hasText: panel }) })
		.first();
	await block.hover();
	await block.locator('.resolve-hint .button-hint').click();
	const drawer = page.locator('article').last();
	await drawer.getByRole('button', { name: new RegExp(type) }).click();
	await drawer.getByRole('textbox').nth(1).fill(key);
	await fill(drawer);
	await drawer.getByRole('button', { name: 'check' }).click();
	await expect(drawer).toBeHidden();
}

/** The Flows section of the item or collection sidebar. */
async function flowsSidebar(page: Page) {
	const trigger = page.locator('.accordion-trigger', { hasText: 'Flows' });
	if ((await trigger.getAttribute('data-state')) !== 'open') await trigger.click();
	return page;
}

test('create a manual flow, edit it, run it twice, read the logs, deactivate and delete it', async ({ browser }) => {
	const runs: Record<string, unknown> = {};

	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const name = `${tag} flow`;
			const revisionsBefore = Number(
				(await hostDb().max({ id: 'id' }).from('directus_revisions').first())?.['id'] ?? 0,
			);

			// overview.vue: the + button opens flow-drawer.vue; name, then Manual on the collection.
			await page.goto(`${url}/admin/settings/flows`);
			await page.locator('header').getByRole('button', { name: 'add' }).click();
			const drawer = page.locator('article').last();
			await drawer.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
			await drawer.getByRole('button', { name: 'arrow_forward' }).click();
			await drawer.getByRole('button', { name: /^touch_app Manual/ }).click();
			// The checkbox list folds after 8 collections ("Show N more"): unfold it only when the database has more.
			await expect(drawer.getByRole('button', { name: 'Collections arrow_drop_down' })).toBeVisible();
			const more = drawer.getByRole('button', { name: /^chevron_right Show \d+ more/ });
			if (await more.isVisible()) await more.click();
			await drawer.getByRole('checkbox', { name: /E2e Flows Posts/i }).click();
			const created = call(page, 'POST', /\/flows$/);
			await drawer.getByRole('button', { name: 'check' }).click();
			expect((await created).status()).toBe(200);

			// flow.vue: a new flow opens in edit mode; Transform after the trigger, Log after it, Save.
			await page.waitForURL(/\/admin\/settings\/flows\/[0-9a-f-]{36}$/);
			const flowUrl = page.url();

			await addOperation(page, 'Manual', 'Transform Payload', 'shape', async () => {
				await page.locator('article .CodeMirror').first().click();
				await page.keyboard.insertText('{"ran": true}');
			});
			await addOperation(page, 'Transform Payload', 'Log to Console', 'note', async (operation) => {
				await operation.getByRole('textbox').nth(2).fill('ran');
			});
			const saved = call(page, 'PATCH', /\/flows\/[0-9a-f-]{36}$/);
			await page.locator('header').getByRole('button', { name: 'check' }).click();
			expect((await saved).status()).toBe(200);

			// use-flows.ts: from the first item, then from a selection of both items in the collection.
			await page.goto(`${url}/admin/content/${COLLECTION}/${keys[0]}`);
			let flows = await flowsSidebar(page);
			let ran = call(page, 'POST', /\/flows\/trigger\/[0-9a-f-]{36}$/);
			await flows.getByRole('button', { name: new RegExp(`${name}$`) }).click();
			expect((await ran).status()).toBe(204);
			await expect(page.getByText(`Flow "${name}" triggered successfully`)).toBeVisible();

			await page.goto(`${url}/admin/content/${COLLECTION}`);
			await expect(page.locator('tbody tr')).toHaveCount(2);
			for (const row of await page.locator('tbody tr').all()) await row.getByRole('checkbox').click();
			flows = await flowsSidebar(page);
			ran = call(page, 'POST', /\/flows\/trigger\/[0-9a-f-]{36}$/);
			await flows.getByRole('button', { name: new RegExp(`${name}$`) }).click();
			expect((await ran).status()).toBe(204);

			// logs-sidebar-detail.vue: two runs, the drawer of one lists both steps.
			await page.goto(flowUrl);
			const logs = page.locator('.accordion-trigger', { hasText: 'Logs' });
			if ((await logs.getAttribute('data-state')) !== 'open') await logs.click();
			await expect(page.locator('.log button')).toHaveCount(2);
			await page.locator('.log button').first().click();
			await expect(page.locator('.v-drawer').last()).toContainText('Transform PayloadOptionsPayloadLog to Console');
			await page.keyboard.press('Escape');

			// overview.vue: Set Flow to Inactive; the item no longer offers the flow; Delete.
			await page.goto(`${url}/admin/settings/flows`);
			const row = page.locator('tbody tr', { hasText: name });
			await row.locator('.ctx-toggle').click();
			const toggled = call(page, 'PATCH', /\/flows\/[0-9a-f-]{36}$/);
			await page.getByText('Set Flow to Inactive').click();
			expect((await toggled).status()).toBe(200);

			await page.goto(`${url}/admin/content/${COLLECTION}/${keys[0]}`);
			await expect(page.getByRole('button', { name })).toHaveCount(0);

			await page.goto(`${url}/admin/settings/flows`);
			await page.locator('tbody tr', { hasText: name }).locator('.ctx-toggle').click();
			await page.getByText('Delete Flow').click();
			const deleted = call(page, 'DELETE', /\/flows\/[0-9a-f-]{36}$/);
			await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
			expect((await deleted).status()).toBe(204);

			// The run revisions: the steps by key and status, the operation ids replaced (compared below).
			const revisions = await hostDb()
				.select('directus_revisions.collection', 'directus_revisions.data', 'directus_activity.action')
				.from('directus_revisions')
				.join('directus_activity', 'directus_activity.id', 'directus_revisions.activity')
				.where('directus_revisions.id', '>', revisionsBefore)
				.whereIn('directus_revisions.collection', ['directus_flows', 'directus_operations'])
				.orderBy('directus_revisions.id');

			runs[tag.slice(-3)] = revisions.map((r: any) => {
				const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
				return r.action === 'run'
					? {
							action: r.action,
							steps: data.steps.map((s: any) => ({ key: s.key, status: s.status })),
							last: data.data.$last,
						}
					: { action: r.action, collection: r.collection };
			});
		},
		['directus_flows', 'directus_operations'],
	);

	expect(changes['prx']).toEqual(changes['dir']);
	expect(runs['prx']).toEqual(runs['dir']);
	expect((runs['dir'] as any[]).filter((r) => r.action === 'run')).toEqual([
		{
			action: 'run',
			steps: [
				{ key: 'shape', status: 'resolve' },
				{ key: 'note', status: 'resolve' },
			],
			last: null,
		},
		{
			action: 'run',
			steps: [
				{ key: 'shape', status: 'resolve' },
				{ key: 'note', status: 'resolve' },
			],
			last: null,
		},
	]);
});
