// Spec 033 (T081): the screenshots of the guide page `guides/json-path-filter`.
import { expect, ready, shot, test } from './shot.js';

test('json path filter', async ({ signedIn: page, data }) => {
	await ready(page, `/content/products?bookmark=${data.jsonPathBookmark}`);
	await page.getByRole('main').getByRole('button', { name: 'Bộ lọc', exact: true }).click();
	await expect(page.getByText(/Thông số › color/)).toBeVisible();
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(1);
	await shot(page, 'json-path-filter-1');
});
