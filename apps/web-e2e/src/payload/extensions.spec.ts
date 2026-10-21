// Spec 020 T095 (contracts/tests.md §4, api-calls #205): Settings > Extensions sends the writes of the Directus app
// 11.17.4. The same UI scenario (disable then enable parity-display-badge from its row menu) runs on the Directus app
// (8155) and on the Backoffice app; the writes and the directus_extensions rows they leave are compared. proxy-api only.
import type { Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { changesSince, closeHostDb, EXTENSIONS_TABLES, scopeChanges, snapshot } from '../helpers/db-rows.js';
import { onDirectusApp } from '../helpers/directus-app.js';
import { normalize, recordWrites, signInBackoffice } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.setTimeout(240_000);

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	await closeHostDb();
});

type Locate = (page: Page) => ReturnType<Page['locator']>;

/** The menu entries: role menuitem in the new app; `.v-list-item` in the Directus app (its v-list-item has no role). */
async function toggleTwice(
	page: Page,
	rowLocator: Locate,
	open: () => Promise<void>,
	item: (page: Page, action: string) => ReturnType<Page['locator']>,
) {
	for (const action of ['Disable', 'Enable']) {
		await open();
		await item(page, action).click();
		await expect(rowLocator(page)).toContainText(action === 'Disable' ? 'Disabled' : 'Enabled');
	}
}

test('disable then enable an extension: the same PATCH bodies and rows', async ({ browser, page }) => {
	const before = await snapshot(EXTENSIONS_TABLES);

	const dir = await onDirectusApp(browser, async (dirPage) => {
		await dirPage.goto(`${directusUrl}/admin/settings/extensions`);
		const dirRow = (p: Page) => p.locator('.v-list-item', { hasText: 'parity-display-badge' }).first();

		return recordWrites(dirPage, directusUrl, () =>
			toggleTwice(
				dirPage,
				dirRow,
				() => dirRow(dirPage).locator('.menu-toggle').click(),
				(p, action) =>
					p
						.locator('.v-list-item')
						.filter({ has: p.locator('.v-list-item-content', { hasText: new RegExp(`^\\s*${action}\\s*$`) }) }),
			),
		);
	});

	// The rows and activity of directus_extensions only: each run also signs in (activity of directus_users).
	const extensionChanges = async (since: Awaited<ReturnType<typeof snapshot>>) =>
		scopeChanges((await changesSince(since, EXTENSIONS_TABLES)) as Record<string, unknown>, EXTENSIONS_TABLES, []);
	const dirRows = await extensionChanges(before);
	const beforeBackoffice = await snapshot(EXTENSIONS_TABLES);

	await signInBackoffice(page, api);
	await page.goto('/admin/settings/extensions');
	const boRow = (p: Page) => p.locator('[data-extension="parity-display-badge"]');

	const bo = await recordWrites(page, apiUrl, () =>
		toggleTwice(
			page,
			boRow,
			() =>
				boRow(page)
					.getByRole('button', { name: /options/i })
					.click(),
			(p, action) => p.getByRole('menuitem', { name: action, exact: true }),
		),
	);

	expect(normalize(bo)).toEqual(normalize(dir));
	expect(await extensionChanges(beforeBackoffice)).toEqual(dirRows);
});
