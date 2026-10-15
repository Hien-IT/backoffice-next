// Feature 014 US7 (T090, SC-004, contracts/tests.md §4): content versions of a bo_content item send the writes of the
// Directus app 11.17.4: create (POST /versions), save (POST /versions/:id/save), rename (PATCH), promote (POST
// /versions/:id/promote with mainHash and fields, version kept) and delete. Each run gets its own item (DATA_PREFIX),
// deleted in afterAll with its versions. proxy-api only.
import type { Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, DATA_PREFIX, directusUrl, e2eConfig } from '../helpers/config.js';
import { openItem } from '../helpers/content.js';
import { card, field, goto, headerButton, onDirectusApp, versionMenu } from '../helpers/directus-app.js';
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
	const versions = await api.call<{ id: string }[]>(
		'GET',
		`/versions?fields=id&filter[key][_starts_with]=${DATA_PREFIX}`,
	);
	if (versions.length) await api.call('DELETE', '/versions', { data: versions.map((v) => v.id) });
	const items = await api.call<{ id: number }[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (items.length) await api.call('DELETE', '/items/bo_content', { data: items.map((i) => i.id) });
});

async function createItem(tag: string): Promise<number> {
	const { id } = await api.call<{ id: number }>('POST', '/items/bo_content', {
		data: { title: `${tag} versions`, status: 'draft' },
	});
	return id;
}

async function directusSteps(page: Page, tag: string, id: number) {
	await goto(page, `/content/bo_content/${id}`);
	await versionMenu(page, /Create Version/);
	await card(page).getByRole('textbox', { name: 'Version Name' }).fill(`${tag}-v`);
	await card(page).getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(new RegExp(`\\?version=${tag}-v$`));

	await field(page, 'Title').locator('input').fill(`${tag} versioned`);
	await headerButton(page, 'beenhere').click();
	await expect(headerButton(page, 'beenhere')).toBeDisabled();

	await versionMenu(page, /Rename Version/);
	await card(page).getByRole('textbox', { name: 'Version Name' }).fill(`${tag}-w`);
	await card(page).getByRole('textbox', { name: 'Version Key' }).fill(`${tag}-w`);
	await card(page).getByRole('button', { name: 'Save' }).click();
	await expect(page).not.toHaveURL(/\?version=/);

	await versionMenu(page, `${tag}-w`);
	await expect(page).toHaveURL(new RegExp(`\\?version=${tag}-w$`));
	await versionMenu(page, /Promote Version/);
	await page.getByRole('button', { name: /Apply$/ }).click();
	await card(page).getByRole('button', { name: 'Keep' }).click();
	// After the promotion the app shows the main item.
	await expect(page).not.toHaveURL(/\?version=/);

	await versionMenu(page, `${tag}-w`);
	await versionMenu(page, /Delete Version/);
	await card(page).getByRole('button', { name: 'Delete' }).click();
	await expect(page).not.toHaveURL(/\?version=/);
}

async function backofficeSteps(page: Page, tag: string, id: number) {
	const versionButton = page.getByRole('button', { name: /^Version: / });
	const version = async (name: string | RegExp, role: 'menuitem' | 'menuitemradio' = 'menuitem') => {
		// The item reloads after a version write and may close a menu opened meanwhile.
		await expect(async () => {
			if (!(await page.getByRole('menu').isVisible())) await versionButton.click();
			await page.getByRole('menu').getByRole(role, { name }).click({ timeout: 2_000 });
		}).toPass();
	};

	await openItem(page, 'bo_content', id);
	await version('Create Version');
	await page.getByRole('dialog').getByRole('textbox', { name: 'Version Name' }).fill(`${tag}-v`);
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(new RegExp(`\\?version=${tag}-v$`));

	await page.getByRole('textbox', { name: 'Title' }).fill(`${tag} versioned`);
	await page.getByRole('button', { name: 'Save Version' }).click();
	await expect(page.getByRole('button', { name: 'Save Version' })).toBeDisabled();

	await version('Rename Version');
	await page.getByRole('dialog').getByRole('textbox', { name: 'Version Name' }).fill(`${tag}-w`);
	await page.getByRole('dialog').getByRole('textbox', { name: 'Version Key' }).fill(`${tag}-w`);
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
	await expect(page).not.toHaveURL(/\?version=/);

	await version(`${tag}-w`, 'menuitemradio');
	await expect(page).toHaveURL(new RegExp(`\\?version=${tag}-w$`));
	await version('Promote Version');
	// "Keep": the modal's "delete the version after promotion" checkbox stays off (Directus asks in a second dialog).
	await page.getByRole('dialog').getByRole('button', { name: 'Apply' }).click();
	await expect(page).not.toHaveURL(/\?version=/);

	await version(`${tag}-w`, 'menuitemradio');
	await version('Delete Version');
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).not.toHaveURL(/\?version=/);
}

test('create, save, rename, promote and delete a version', async ({ browser, page }) => {
	const dirItem = await createItem(RUN_TAG.dir);
	const dir = await onDirectusApp(browser, (p) =>
		recordWrites(p, directusUrl, () => directusSteps(p, RUN_TAG.dir, dirItem)),
	);

	const boItem = await createItem(RUN_TAG.bo);
	await signInBackoffice(page, api);
	const bo = await recordWrites(page, apiUrl, () => backofficeSteps(page, RUN_TAG.bo, boItem));

	expect(calls(normalize(dir, [dirItem]))).toEqual([
		'POST /versions',
		'POST /versions/<id2>/save',
		'PATCH /versions/<id2>',
		'POST /versions/<id2>/promote',
		'DELETE /versions/<id2>',
	]);
	expect(normalize(bo, [boItem])).toEqual(normalize(dir, [dirItem]));
});
