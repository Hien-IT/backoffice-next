// Spec 033 (T087): the screenshots of the guide page `guides/environment-sync`.
import { expect, ready, shot, test } from './shot.js';
import { SOURCE_TOKEN, SOURCE_URL } from './seed.js';

test('environment sync', async ({ signedIn: page }) => {
	test.skip(!SOURCE_TOKEN, 'DOCS_SYNC_SOURCE_TOKEN names the static token of the source API');
	await ready(page, '/settings/sync');
	const url = page.getByLabel('URL nguồn');
	await url.fill(SOURCE_URL);
	await page.getByLabel('Static token admin của nguồn').fill(SOURCE_TOKEN);
	await page.getByRole('button', { name: 'So sánh', exact: true }).click();
	await expect(page.getByText('Gửi hóa đơn').first()).toBeVisible({ timeout: 30_000 });
	// The URL of the source and its version line name a machine: masked (FR-037); the token field shows dots only.
	await shot(page, 'environment-sync-1', { mask: [url] });
});
