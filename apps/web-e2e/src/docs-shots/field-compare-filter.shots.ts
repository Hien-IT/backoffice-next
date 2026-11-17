// Spec 033 (T083): the screenshots of the guide page `guides/field-compare-filter`.
import { expect, ready, shot, test } from './shot.js';

test('field compare filter', async ({ signedIn: page, data }) => {
	await ready(page, `/content/products?bookmark=${data.fieldCompareBookmark}`);
	await page.getByRole('main').getByRole('button', { name: 'Bộ lọc', exact: true }).click();
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr')).toHaveCount(3);
	await shot(page, 'field-compare-filter-1');
});
