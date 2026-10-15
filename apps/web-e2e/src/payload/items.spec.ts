// Feature 014 US7 (T088, SC-004, contracts/tests.md §4): the item page of bo_content sends the same writes as the
// Directus app 11.17.4: create (save and stay), edit (save), save as copy (POST /graphql then POST), archive, delete.
// proxy-api only; the rows both runs create carry DATA_PREFIX and are deleted in afterAll.
import type { Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, DATA_PREFIX, directusUrl, e2eConfig } from '../helpers/config.js';
import { openItem } from '../helpers/content.js';
import { card, field, goto, headerButton, onDirectusApp } from '../helpers/directus-app.js';
import { calls, normalize, recordWrites, RUN_TAG, signInBackoffice } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	await api.call('POST', '/utils/cache/clear');
	const created = await api.call<{ id: number }[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (created.length) await api.call('DELETE', '/items/bo_content', { data: created.map((i) => i.id) });
});

async function directusSteps(page: Page, tag: string) {
	const title = field(page, 'Title').locator('input');
	await goto(page, '/content/bo_content/+');
	await title.fill(`${tag} item`);
	await headerButton(page, 'more_vert').click();
	await page.getByRole('button', { name: /Save and Stay/ }).click();
	await expect(page).toHaveURL(/\/bo_content\/\d+$/);
	const itemUrl = page.url();

	await title.fill(`${tag} edited`);
	await headerButton(page, 'check').click();
	await expect(page).toHaveURL(/\/bo_content$/);

	await page.goto(itemUrl);
	await title.fill(`${tag} copy`);
	await headerButton(page, 'more_vert').click();
	await page.getByRole('button', { name: /Save as Copy/ }).click();
	await expect(page).not.toHaveURL(itemUrl);
	await expect(page).toHaveURL(/\/bo_content\/\d+$/);

	await headerButton(page, 'archive').click();
	await card(page).getByRole('button', { name: 'Archive' }).click();
	await expect(page).toHaveURL(/\/bo_content$/);

	await page.goto(itemUrl);
	await headerButton(page, 'delete').click();
	await card(page).getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/bo_content$/);
}

async function backofficeSteps(page: Page, tag: string) {
	const title = page.getByRole('textbox', { name: 'Title' });
	const saveOption = async (name: string) => {
		await page.getByRole('button', { name: 'More Save Options' }).click();
		await page.getByRole('menuitem', { name }).click();
	};

	await openItem(page, 'bo_content', '+');
	await title.fill(`${tag} item`);
	await saveOption('Save and Stay');
	await expect(page).toHaveURL(/\/bo_content\/\d+$/);
	const itemUrl = page.url();

	await title.fill(`${tag} edited`);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/bo_content$/);

	await page.goto(itemUrl);
	await expect(title).toHaveValue(`${tag} edited`);
	await title.fill(`${tag} copy`);
	await saveOption('Save as Copy');
	await expect(page).not.toHaveURL(itemUrl);
	await expect(page).toHaveURL(/\/bo_content\/\d+$/);

	await page.getByRole('button', { name: 'Archive', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
	await expect(page).toHaveURL(/\/bo_content$/);

	await page.goto(itemUrl);
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/bo_content$/);
}

test('create, edit, save as copy, archive and delete send the Directus app writes', async ({ browser, page }) => {
	const dir = await onDirectusApp(browser, (p) => recordWrites(p, directusUrl, () => directusSteps(p, RUN_TAG.dir)));

	await signInBackoffice(page, api);
	const bo = await recordWrites(page, apiUrl, () => backofficeSteps(page, RUN_TAG.bo));

	expect(calls(normalize(dir))).toEqual([
		'POST /items/bo_content',
		'PATCH /items/bo_content/<id1>',
		'POST /graphql',
		'POST /items/bo_content',
		'PATCH /items/bo_content/<id2>',
		'DELETE /items/bo_content/<id1>',
	]);
	expect(normalize(bo)).toEqual(normalize(dir));
});
