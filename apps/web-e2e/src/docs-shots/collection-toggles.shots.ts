// Spec 033 (T080): the screenshots of the guide page `guides/collection-toggles`.
import { card, expect, ready, shot, test } from './shot.js';
import { L } from './lang.js';

test('collection toggles', async ({ signedIn: page }) => {
	await ready(page, '/settings/data-model/products');
	const toggles = card(page, L('Content: tìm kiếm, Import, Export'));
	await toggles.scrollIntoViewIfNeeded();
	await expect(toggles).toBeVisible();
	await shot(page, 'collection-toggles-1', { of: toggles });
});
