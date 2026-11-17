// Spec 033 (T082): the screenshots of the guide page `guides/import-export-permissions`.
import { expect, ready, shot, test } from './shot.js';

test('import and export permissions', async ({ signedIn: page, data }) => {
	await ready(page, `/settings/policies/${data.policyId}`);
	const matrix = page.locator('[data-permissions-matrix]').first();
	const row = matrix.getByRole('row').filter({ hasText: 'products' }).first();
	await row.getByRole('button', { name: /Export/ }).click();
	await expect(page.getByRole('menuitem').or(page.getByRole('dialog')).first()).toBeVisible();
	await shot(page, 'import-export-permissions-1');
});
