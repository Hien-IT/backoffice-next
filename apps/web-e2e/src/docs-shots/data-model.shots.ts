// Spec 033 (T076): the screenshots of the guide page `guides/data-model`.
import { expect, ready, shot, test } from './shot.js';

test('data model', async ({ signedIn: page }) => {
	await ready(page, '/settings/data-model');
	await expect(page.getByRole('main').getByText('products').first()).toBeVisible();
	await shot(page, 'data-model-1');

	await ready(page, '/settings/data-model/products');
	await expect(page.getByRole('main').getByText('min_stock').first()).toBeVisible();
	await shot(page, 'data-model-2');
});
