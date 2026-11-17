// Spec 033 (T085): the screenshots of the guide page `guides/collection-indexes`.
import { card, expect, ready, shot, test } from './shot.js';

test('collection indexes', async ({ signedIn: page }) => {
	await ready(page, '/settings/data-model/products');
	const indexes = card(page, 'Index');
	await indexes.scrollIntoViewIfNeeded();
	await expect(indexes).toContainText('status');
	await shot(page, 'collection-indexes-1', { of: indexes });
});
