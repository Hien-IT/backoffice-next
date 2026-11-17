// Spec 033 (T086): the screenshots of the guide page `guides/extension-upload`.
import { expect, ready, shot, test } from './shot.js';

test('extension upload', async ({ signedIn: page }) => {
	await ready(page, '/settings/extensions');
	await page.getByRole('button', { name: 'Tải extension lên' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await shot(page, 'extension-upload-1');
});
