// Feature 016 T003 (research "Kết quả kiểm T002", contracts/tests.md §4): records what the Directus app 11.17.4 sends for
// two data model write flows (new collection with the six optional system fields, a many-to-many field in simple mode)
// and stores the normalized writes in
// src/payload/baselines/settings-*.json. The component tests of apps/web (T032, T054) compare their request bodies with
// these files. Drives only the Directus app (DIRECTUS_URL); runs when RECORD_BASELINES=1, never in CI.
import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { directusUrl } from '../helpers/config.js';
import { directusApi, dismissOwnerDialog, onDirectusApp } from '../helpers/directus-app.js';
import { normalize, recordWrites } from '../helpers/payload.js';

test.skip(process.env['RECORD_BASELINES'] !== '1', 'records Directus app baselines on demand (RECORD_BASELINES=1)');
test.use({ actionTimeout: 15_000 });

const COLLECTION = 'bo_t003_col';
const RELATED = 'bo_t003_tag';
const OUT = new URL('./baselines/', import.meta.url);

async function cleanup(): Promise<void> {
	const collections: { collection: string }[] = await directusApi('GET', '/collections');
	// Junction first: its relations point at both sides.
	const ours = collections.map((c) => c.collection).filter((c) => c.startsWith('bo_t003'));
	for (const name of ours.sort((a, b) => b.length - a.length)) await directusApi('DELETE', `/collections/${name}`);
}

function save(name: string, writes: unknown): void {
	writeFileSync(new URL(`settings-${name}.json`, OUT), `${JSON.stringify(writes, null, '\t')}\n`);
}

/** Opens a Settings page of the Directus app; floating routes (`+`) add a second main area, so wait for the first. */
async function goto(page: Page, path: string): Promise<void> {
	await page.goto(`${directusUrl}/admin${path}`);
	await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15_000 });
	await dismissOwnerDialog(page);
}

/** A drawer header button of the Directus app, named by its icon. */
function drawerButton(page: Page, icon: string) {
	return page.locator('.v-drawer').getByRole('button', { name: icon, exact: true });
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

test('new collection with the six optional system fields', async ({ browser }) => {
	await onDirectusApp(browser, async (page) => {
		await goto(page, '/settings/data-model/+');
		const recorded = await recordWrites(page, directusUrl, async () => {
			await page.getByPlaceholder('A unique table name...').fill(COLLECTION);
			await drawerButton(page, 'arrow_forward').click();
			for (const box of await page.locator('.system .v-checkbox').all()) await box.click();
			await drawerButton(page, 'check').click();
			await expect(page).toHaveURL(new RegExp(`/settings/data-model/${COLLECTION}$`), { timeout: 30_000 });
		});
		save('collection', normalize(recorded));
	});
});

test('many-to-many field in simple mode', async ({ browser }) => {
	await onDirectusApp(browser, async (page) => {
		await goto(page, `/settings/data-model/${COLLECTION}`);
		const recorded = await recordWrites(page, directusUrl, async () => {
			await page.getByRole('link', { name: 'Create Field', exact: true }).click();
			await page.locator('.interface', { hasText: 'Many to Many' }).click();
			await page.locator('.field-configuration').getByPlaceholder('A unique column name...').fill('tags');
			await page.locator('.field-configuration').getByPlaceholder('Collection...').fill(RELATED);
			await page.locator('.v-drawer').getByRole('button', { name: 'Save', exact: true }).click();
			await expect(page.locator('.v-drawer')).toHaveCount(0, { timeout: 30_000 });
		});
		save('field-m2m', normalize(recorded));
	});
});
