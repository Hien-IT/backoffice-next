// Spec 033 (T071): the screenshots of the guide page `guides/content`.
import { expect, ready, shot, test } from './shot.js';

test('content', async ({ signedIn: page, data }) => {
	await ready(page, '/content/products');
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(6);
	await shot(page, 'content-1');

	await ready(page, `/content/products/${data.productIds[1]}`);
	await expect(page.getByRole('main').locator('[data-field="specs"]').first()).toBeVisible();
	await shot(page, 'content-2');
});
