// Feature 014 US7 (T089, SC-004, SC-005, contracts/tests.md §4): the presets the collection page writes are those of the
// Directus app 11.17.4: auto-save of the layout state (cards sort and size, table sort, column and spacing, calendar,
// kanban and map options: the first write is a POST, then PATCH), bookmark create/update/delete, and a three-level filter
// (the `filter` of the PATCH bodies). A fixture admin user (DATA_PREFIX) owns the presets, so the admin's presets of other
// specs stay out; its presets are reset before each run. proxy-api only.
import { isDeepStrictEqual } from 'node:util';
import type { Browser, Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { chooseLayout, openCollection, openLayoutOptions, waitForTable } from '../helpers/content.js';
import {
	card,
	chooseInMenu,
	goto,
	headerButton,
	layoutOption,
	onDirectusApp,
	openFilter,
	sidebar,
	type SignIn,
} from '../helpers/directus-app.js';
import { Fixtures } from '../helpers/fixtures.js';
import { calls, normalize, recordWrites, RUN_TAG, signInBackoffice } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: 'serial' });

const FILTER = {
	_and: [{ _or: [{ title: { _contains: 'Content' } }, { _and: [{ status: { _eq: 'published' } }] }] }],
};

let api: AdminApi;
let fixtures: Fixtures;
let user: SignIn & { id: string };

test.beforeAll(async ({ playwright }) => {
	const request = await playwright.request.newContext();
	api = new AdminApi(request);
	// The web app's preview server only proxies the app's API paths: users, roles and policies go to Directus (same DB).
	fixtures = new Fixtures(new AdminApi(request, directusUrl));
	const role = await fixtures.role('payload presets', { admin: true });
	user = await fixtures.user('presets', { role });
});

test.afterAll(async () => {
	if (user) await resetPresets();
	await fixtures.cleanup();
});

/** Deletes the user's presets (then seeds `preset` when given) so both runs start from the same state. */
async function resetPresets(preset?: Record<string, unknown>) {
	const mine = await api.call<{ id: number }[]>('GET', `/presets?fields=id&limit=-1&filter[user][_eq]=${user.id}`);
	if (mine.length) await api.call('DELETE', '/presets', { data: mine.map((p) => p.id) });
	if (preset) await api.call('POST', '/presets', { data: { collection: 'bo_content', user: user.id, ...preset } });
	await api.call('POST', '/utils/cache/clear');
}

/** Runs `action` and waits for the answer to the preset write it causes (the next write needs the created id). */
async function saved(page: Page, action: () => Promise<void>) {
	const write = page.waitForResponse((r) => /\/presets(\/\d+)?$/.test(r.url()) && r.request().method() !== 'GET');
	await action();
	await write;
}

/** Same scenario on both apps; returns [Backoffice, Directus] writes, normalized. */
async function compare(
	browser: Browser,
	page: Page,
	steps: {
		directus: (page: Page, tag: string) => Promise<void>;
		backoffice: (page: Page, tag: string) => Promise<void>;
	},
	preset?: Record<string, unknown>,
) {
	await resetPresets(preset);
	const dir = await onDirectusApp(
		browser,
		(p) => recordWrites(p, directusUrl, () => steps.directus(p, RUN_TAG.dir)),
		user,
	);
	await resetPresets(preset);
	await signInBackoffice(page, api, user);
	const bo = await recordWrites(page, apiUrl, () => steps.backoffice(page, RUN_TAG.bo));
	return [normalize(bo), normalize(dir)] as const;
}

/**
 * The map layout saves `cameraOptions` on moveend, also after it fits the data when the items arrive after the map
 * loaded: in both apps the same code, but whether that write happens depends on the API and tile timing (an extra PATCH
 * at Backoffice in CI 39603142732, 39629189282, 39652197946, none in other runs). The camera is left out and a write that
 * only changed it is dropped; MapLayout.browser.test.ts checks the camera writes.
 */
function withoutCamera<T>(writes: readonly T[]): T[] {
	const result: T[] = [];
	for (const write of writes) {
		const copy = structuredClone(write);
		delete (copy as { body?: { layout_options?: { map?: Record<string, unknown> } } }).body?.layout_options?.map?.[
			'cameraOptions'
		];
		// Key order differs between writes (the camera comes first or last): compare deeply, not as JSON text.
		if (!isDeepStrictEqual(copy, result.at(-1))) result.push(copy);
	}
	return result;
}

test('layout state auto-save: cards, table, calendar, kanban, map (SC-005)', async ({ browser, page }) => {
	const [boWrites, dirWrites] = await compare(browser, page, {
		async directus(page) {
			const main = page.getByRole('main');
			await goto(page, '/content/bo_content');
			await saved(page, () => main.getByRole('button', { name: 'sort', exact: true }).click());
			await saved(page, () => main.locator('.size-selector').click());

			await saved(page, () => layoutOption(page, 'Layout', 'Table'));
			await saved(page, async () => {
				await main.getByRole('button', { name: /^Title/ }).click();
				await chooseInMenu(page, /Sort Descending/);
			});
			await saved(page, async () => {
				await main.getByRole('button', { name: 'add', exact: true }).click();
				await chooseInMenu(page, 'ID');
			});
			await saved(page, () => layoutOption(page, 'Spacing', 'Compact'));

			await saved(page, () => layoutOption(page, 'Layout', 'Calendar'));
			await saved(page, () => layoutOption(page, 'Start Date Field', 'Date Published'));
			await saved(page, () => layoutOption(page, 'Layout', 'Kanban'));
			await saved(page, () => layoutOption(page, 'Card Title', 'Title'));
			await saved(page, () => layoutOption(page, 'Layout', 'Map'));
			await saved(page, () =>
				sidebar(page)
					.getByRole('checkbox', { name: /Cluster Nearby Data/ })
					.click(),
			);
		},
		async backoffice(page) {
			const main = page.getByRole('main');
			const option = async (label: string, name: string) => {
				await openLayoutOptions(page);
				await page.getByRole('combobox', { name: label, exact: true }).click();
				await page.getByRole('option', { name, exact: true }).click();
			};
			await openCollection(page, 'bo_content');
			await saved(page, () => main.getByRole('button', { name: 'Sort Direction' }).click());
			await saved(page, () => main.getByRole('button', { name: 'Card Size' }).click());

			await saved(page, () => chooseLayout(page, 'Table'));
			const table = await waitForTable(page);
			await saved(page, async () => {
				await table.getByRole('button', { name: 'Title', exact: true }).click();
				await page.getByRole('menuitemradio', { name: 'Sort Descending' }).click();
			});
			await saved(page, async () => {
				await table.getByRole('button', { name: 'Add Field' }).click();
				await page.getByRole('dialog', { name: 'Add Field' }).getByRole('treeitem', { name: 'ID' }).click();
			});
			await saved(page, () => option('Spacing', 'Compact'));

			await saved(page, () => chooseLayout(page, 'Calendar'));
			await saved(page, () => option('Start Date Field', 'Date Published'));
			await saved(page, () => chooseLayout(page, 'Kanban'));
			await saved(page, () => option('Card Title', 'Title'));
			await saved(page, () => chooseLayout(page, 'Map'));
			await saved(page, async () => {
				await openLayoutOptions(page);
				await page.getByRole('checkbox', { name: 'Cluster Nearby Data' }).click();
			});
		},
	});

	const [bo, dir] = [withoutCamera(boWrites), withoutCamera(dirWrites)];
	expect(calls(dir)).toEqual(['POST /presets', ...Array(11).fill('PATCH /presets/<id1>')]);
	// The writes answering the steps match one to one. A write may still arrive after the last step: the map layout
	// writes again once its data loads after the map (CI 39676151517 kept one even without the camera); it is a map
	// write, and its body is logged to show which part changed.
	expect(bo.slice(0, dir.length)).toEqual(dir);
	const late = bo.slice(dir.length);
	if (late.length > 0) console.log('presets: late map writes', JSON.stringify(late)); // eslint-disable-line no-console
	for (const write of late) expect(write).toMatchObject({ method: 'PATCH', body: { layout: 'map' } });
});

test('bookmark: create, update, delete', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		{
			async directus(page, tag) {
				await goto(page, '/content/bo_content');
				await headerButton(page, 'bookmark').click();
				await card(page).getByRole('textbox', { name: 'Bookmark name...' }).fill(`${tag} bookmark`);
				await card(page).getByRole('button', { name: 'Save' }).click();
				await expect(page).toHaveURL(/\?bookmark=\d+$/);

				await page
					.getByRole('main')
					.getByRole('button', { name: /^Title/ })
					.click();
				await chooseInMenu(page, /Sort Ascending/);
				await page.getByRole('banner').locator('button.save').click();
				await expect(page.getByRole('banner').locator('button.save')).toHaveCount(0);

				await page
					.getByRole('navigation', { name: 'Module Navigation' })
					.getByRole('link', { name: new RegExp(`${tag} bookmark`) })
					.getByRole('button', { name: 'more_vert' })
					.click();
				await chooseInMenu(page, /Delete Personal Bookmark/);
				await card(page).getByRole('button', { name: 'Delete' }).click();
				await expect(page).toHaveURL(/\/bo_content$/);
			},
			async backoffice(page, tag) {
				await openCollection(page, 'bo_content');
				await waitForTable(page);
				await page.getByRole('button', { name: 'Create Bookmark' }).click();
				await page.getByRole('dialog').getByRole('textbox').first().fill(`${tag} bookmark`);
				await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
				await expect(page).toHaveURL(/\?bookmark=\d+$/);

				await page.getByRole('main').getByRole('table').getByRole('button', { name: 'Title', exact: true }).click();
				await page.getByRole('menuitemradio', { name: 'Sort Ascending' }).click();
				await page.getByRole('button', { name: 'Update Bookmark' }).click();
				await expect(page.getByRole('button', { name: 'Update Bookmark' })).toHaveCount(0);

				const tree = page.getByRole('tree', { name: 'Collections' });
				await tree.getByRole('button', { name: `Options for ${tag} bookmark` }).click();
				await page.getByRole('menuitem', { name: 'Delete Personal Bookmark' }).click();
				await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
				await expect(page).toHaveURL(/\/bo_content$/);
			},
		},
		{ layout: 'tabular', filter: FILTER },
	);

	// After the delete, the app goes back to the collection and saves the user's preset (page reset).
	expect(calls(dir)).toEqual(['POST /presets', 'PATCH /presets/<id1>', 'DELETE /presets', 'PATCH /presets/<id>']);
	expect(bo).toEqual(dir);
});

test('three-level filter: value, group logic and choice edits write the same `filter`', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		{
			async directus(page) {
				await goto(page, '/content/bo_content');
				const filter = await openFilter(page);
				await saved(page, () => filter.locator('input[type="text"]').first().fill('Content 0'));
				await saved(page, () => filter.locator('.logic-type .key').nth(1).click());
				await saved(page, async () => {
					await filter.getByRole('button', { name: 'Published', exact: true }).click();
					await chooseInMenu(page, 'Draft');
				});
			},
			async backoffice(page) {
				await openCollection(page, 'bo_content');
				await waitForTable(page);
				await page.getByRole('button', { name: 'Filter', exact: true }).click();
				const filter = page.getByRole('dialog', { name: 'Filter' });
				await saved(page, () => filter.getByRole('textbox', { name: 'Value' }).fill('Content 0'));
				await saved(page, () => filter.getByRole('button', { name: 'AND', exact: true }).click());
				await saved(page, async () => {
					await filter.getByRole('button', { name: 'Published', exact: true }).click();
					await page.getByRole('menuitem', { name: 'Draft', exact: true }).click();
				});
			},
		},
		{ layout: 'tabular', filter: FILTER },
	);

	expect(calls(dir)).toEqual(['PATCH /presets/<id>', 'PATCH /presets/<id>', 'PATCH /presets/<id>']);
	expect((dir.at(-1)!.body as { filter: unknown }).filter).toEqual({
		_and: [{ _or: [{ title: { _contains: 'Content 0' } }, { _or: [{ status: { _eq: 'draft' } }] }] }],
	});
	expect(bo).toEqual(dir);
});
