// Feature 014 US7 (T092, SC-004, contracts/tests.md §4): the collection page's bulk and /utils writes are those of the
// Directus app 11.17.4: batch edit (PATCH /items/<c> with keys and data) and batch delete (DELETE with keys), manual
// sort by drag (/utils/sort), export downloaded (the files are compared once ids and run tags are replaced), export to
// the file library (POST /utils/export/<c>) and CSV import (POST /utils/import/<c>: multipart part names and file
// name). A fixture admin user (DATA_PREFIX) owns a preset that searches the run's rows, so each run only sees its own
// rows; the rows, imported rows and exported files are deleted afterwards. proxy-api only.
import type { Browser, Locator, Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, DATA_PREFIX, directusUrl, e2eConfig } from '../helpers/config.js';
import { openCollection, openSidebar, waitForTable } from '../helpers/content.js';
import {
	card,
	chooseInMenu,
	field,
	goto,
	headerButton,
	onDirectusApp,
	openSidebarSection,
	sidebar,
	type SignIn,
} from '../helpers/directus-app.js';
import { Fixtures } from '../helpers/fixtures.js';
import {
	calls,
	captureFormData,
	normalize,
	type Recorded,
	recordWrites,
	RUN_TAG,
	signInBackoffice,
} from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: 'serial' });

let api: AdminApi;
let fixtures: Fixtures;
let user: SignIn & { id: string };
/** Ids of the rows of the current run (setUp). */
let runRows: number[] = [];

test.beforeAll(async ({ playwright }) => {
	const request = await playwright.request.newContext();
	api = new AdminApi(request);
	// The web app's preview server only proxies the app's API paths: users, roles and policies go to Directus (same DB).
	fixtures = new Fixtures(new AdminApi(request, directusUrl));
	const role = await fixtures.role('payload utils', { admin: true });
	user = await fixtures.user('utils', { role });
});

test.afterAll(async () => {
	if (user) {
		await deleteRows();
		// /utils/sort renumbers the rows in between: give the seeded rows their seeded `sort` back (sort = id, snapshot
		// items.bo_content.json), so later specs (CSV export) see the seeded order.
		const seeded = await api.call<{ id: number }[]>('GET', '/items/bo_content?fields=id&limit=-1&filter[id][_lte]=30');
		await api.call('PATCH', '/items/bo_content', { data: seeded.map(({ id }) => ({ id, sort: id })) });
		const presets = await api.call<{ id: number }[]>('GET', `/presets?fields=id&filter[user][_eq]=${user.id}`);
		if (presets.length) await api.call('DELETE', '/presets', { data: presets.map((p) => p.id) });
		const files = await api.call<{ id: string }[]>('GET', `/files?fields=id&filter[uploaded_by][_eq]=${user.id}`);
		for (const file of files) await api.call('DELETE', `/files/${file.id}`);
	}
	await fixtures.cleanup();
});

async function deleteRows() {
	await api.call('POST', '/utils/cache/clear');
	const rows = await api.call<{ id: number }[]>(
		'GET',
		`/items/bo_content?fields=id&limit=-1&filter[title][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`,
	);
	if (rows.length) await api.call('DELETE', '/items/bo_content', { data: rows.map((r) => r.id) });
}

/** Two rows of the run and a user preset (table sorted by `sort`) that searches them; returns their ids. */
async function setUp(tag: string): Promise<number[]> {
	await deleteRows();
	const presets = await api.call<{ id: number }[]>('GET', `/presets?fields=id&filter[user][_eq]=${user.id}`);
	if (presets.length) await api.call('DELETE', '/presets', { data: presets.map((p) => p.id) });
	await api.call('POST', '/presets', {
		data: {
			collection: 'bo_content',
			user: user.id,
			layout: 'tabular',
			search: `${tag} row`,
			layout_query: { tabular: { fields: ['title', 'status', 'body'], sort: ['sort'] } },
		},
	});
	const rows = await api.call<{ id: number }[]>('POST', '/items/bo_content', {
		data: [
			{ title: `${tag} row 1`, status: 'draft', sort: 1 },
			{ title: `${tag} row 2`, status: 'draft', sort: 2 },
		],
	});
	await api.call('POST', '/utils/cache/clear');
	runRows = rows.map((r) => r.id);
	return runRows;
}

type Steps = (page: Page, tag: string) => Promise<void>;

/** Same steps on both apps from the collection page; returns [Backoffice, Directus] recordings with their row ids. */
async function compare(browser: Browser, page: Page, directus: Steps, backoffice: Steps) {
	const dirRows = await setUp(RUN_TAG.dir);
	const dir = await onDirectusApp(
		browser,
		async (p) => {
			await captureFormData(p);
			await goto(p, '/content/bo_content');
			await expect(p.getByRole('main').locator('tbody tr')).toHaveCount(2);
			return recordWrites(p, directusUrl, () => directus(p, RUN_TAG.dir));
		},
		user,
	);

	const boRows = await setUp(RUN_TAG.bo);
	await signInBackoffice(page, api, user);
	await captureFormData(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(2);
	const bo = await recordWrites(page, apiUrl, () => backoffice(page, RUN_TAG.bo));
	return { bo, boRows, dir, dirRows };
}

function same(result: { bo: Recorded; boRows: number[]; dir: Recorded; dirRows: number[] }, expected: string[]) {
	const dir = normalize(result.dir, result.dirRows);
	expect(calls(dir)).toEqual(expected);
	expect(normalize(result.bo, result.boRows)).toEqual(dir);
}

const dirRows = (page: Page) => page.getByRole('main').locator('tbody tr');
const boTable = (page: Page) => page.getByRole('main').getByRole('table');

async function selectAllDirectus(page: Page) {
	for (const row of await dirRows(page).all()) await row.getByRole('checkbox').click();
}

async function selectAllBackoffice(page: Page) {
	for (const box of await boTable(page).getByRole('checkbox', { name: 'Select Item' }).all()) await box.click();
}

test('batch edit and batch delete', async ({ browser, page }) => {
	const result = await compare(
		browser,
		page,
		async (page, tag) => {
			await selectAllDirectus(page);
			await headerButton(page, 'edit').click();
			const drawer = page.locator('.v-drawer').last();
			await field(drawer, 'Body').getByRole('checkbox').click();
			await field(drawer, 'Body').locator('textarea').fill(`${tag} batch body`);
			await drawer.getByRole('button', { name: 'check', exact: true }).click();
			await expect(page.locator('.v-drawer')).toHaveCount(0);

			await selectAllDirectus(page);
			await headerButton(page, 'delete').click();
			await card(page).getByRole('button', { name: 'Delete' }).click();
			await expect(dirRows(page)).toHaveCount(0);
		},
		async (page, tag) => {
			await selectAllBackoffice(page);
			await page.getByRole('main').getByRole('button', { name: 'Edit', exact: true }).click();
			const drawer = page.getByRole('dialog', { name: /^Batch Editing/ });
			await drawer.getByRole('checkbox', { name: 'Body' }).click();
			await drawer.getByRole('textbox', { name: 'Body' }).fill(`${tag} batch body`);
			await drawer.getByRole('button', { name: 'Save' }).click();
			await expect(drawer).toHaveCount(0);

			await selectAllBackoffice(page);
			await page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(boTable(page).locator('tbody tr')).toHaveCount(0);
		},
	);

	same(result, ['PATCH /items/bo_content', 'DELETE /items/bo_content']);
});

/**
 * Drags the second row's handle onto the first row with small mouse steps (SortableJS in both apps: one dragTo is not
 * seen as a drag). The preset sorts by the sort field, so manual sorting is already on.
 */
async function dragSecondRowUp(page: Page, rows: Locator) {
	const handles = rows.locator('.drag-handle');
	const from = (await handles.nth(1).boundingBox())!;
	const to = (await handles.nth(0).boundingBox())!;
	const x = from.x + from.width / 2;
	await page.mouse.move(x, from.y + from.height / 2);
	await page.waitForTimeout(300);
	await page.mouse.down();
	await page.waitForTimeout(300);
	for (let step = 1; step <= 10; step++) {
		await page.mouse.move(x, from.y + from.height / 2 + ((to.y - from.y - 10) * step) / 10);
		await page.waitForTimeout(50);
	}
	await page.mouse.up();
	await expect(rows.first()).toContainText('row 2');
}

test('manual sort by drag (/utils/sort)', async ({ browser, page }) => {
	const result = await compare(
		browser,
		page,
		(page) => dragSecondRowUp(page, dirRows(page)),
		(page) => dragSecondRowUp(page, boTable(page).locator('tbody tr')),
	);

	same(result, ['POST /utils/sort/bo_content']);
});

/** The export file a download request points at, fetched again with the session, ids and run tag replaced. */
async function exportedFile(page: Page, download: () => Promise<void>): Promise<string> {
	const request = page.context().waitForEvent('request', (r) => r.url().includes('export=csv'));
	await download();
	const file = await page.context().request.get((await request).url());
	expect(file.status()).toBe(200);
	let text = (await file.text()).split(RUN_TAG.dir).join('<prefix>').split(RUN_TAG.bo).join('<prefix>');
	runRows.forEach((id, i) => (text = text.replace(new RegExp(`(^|\\n)${id},`), `$1<id${i + 1}>,`)));
	return text;
}

test('export: downloaded file and export to the file library', async ({ browser, page }) => {
	const files: string[] = [];

	const result = await compare(
		browser,
		page,
		async (page) => {
			const drawer = page.locator('.v-drawer').last();
			const open = async () => {
				await openSidebarSection(page, 'Import / Export');
				await sidebar(page).getByRole('button', { name: 'Export Items' }).click();
				await expect(drawer.getByRole('heading', { name: 'Export Items' })).toBeVisible();
			};

			await open();
			files.push(await exportedFile(page, () => drawer.getByRole('button', { name: 'download', exact: true }).click()));
			if (!(await drawer.isVisible())) await open();

			// Export Location (the second select after Format).
			await drawer.locator('.v-select').nth(1).click();
			await chooseInMenu(page, 'File Library');
			await drawer.getByRole('button', { name: 'start', exact: true }).click();
			await expect(page.locator('.v-drawer')).toHaveCount(0);
		},
		async (page) => {
			const drawer = page.getByRole('dialog', { name: 'Export Items' });
			const open = async () => {
				await openSidebar(page);
				const section = page
					.getByRole('complementary', { name: 'Sidebar' })
					.getByRole('button', { name: 'Import / Export' });
				if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click();
				await page.getByRole('button', { name: 'Export Items' }).click();
				await expect(drawer).toBeVisible();
			};

			await open();
			files.push(await exportedFile(page, () => drawer.getByRole('button', { name: 'Download File' }).click()));
			if (!(await drawer.isVisible())) await open();

			await drawer.getByRole('radio', { name: 'File Library' }).click();
			await drawer.getByRole('button', { name: /^(Start Export|Export Items|Export)$/ }).click();
			await expect(drawer).toHaveCount(0);
		},
	);

	same(result, ['POST /utils/export/bo_content']);
	expect(files[1]).toBe(files[0]);
	expect(files[0]).toContain('<prefix> row 1');
});

test('import CSV: multipart part names and file name', async ({ browser, page }) => {
	const csv = (tag: string) => ({
		name: `${tag}.csv`,
		mimeType: 'text/csv',
		buffer: Buffer.from(`title,status\n${tag} imported,draft\n`),
	});

	const result = await compare(
		browser,
		page,
		async (page, tag) => {
			await openSidebarSection(page, 'Import / Export');
			await sidebar(page).locator('input[type="file"]').setInputFiles(csv(tag));
			await sidebar(page).getByRole('button', { name: 'Start Import' }).click();
			await expect(sidebar(page).getByRole('button', { name: 'Start Import' })).toBeDisabled();
		},
		async (page, tag) => {
			await openSidebar(page);
			const side = page.getByRole('complementary', { name: 'Sidebar' });
			await side.getByRole('button', { name: 'Import / Export' }).click();
			await side.locator('input[type="file"]').setInputFiles(csv(tag));
			await side.getByRole('button', { name: 'Start Import' }).click();
			await expect(side.getByRole('button', { name: 'Start Import' })).toBeDisabled();
		},
	);

	same(result, ['POST /utils/import/bo_content']);
	expect(normalize(result.dir)[0]!.body).toEqual({ multipart: [{ name: 'file', filename: '<prefix>.csv' }] });
});
