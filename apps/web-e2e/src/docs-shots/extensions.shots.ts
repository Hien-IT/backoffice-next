// Spec 033 (T079): the screenshots of the guide page `guides/extensions`.
import { expect, ready, shot, test } from './shot.js';

test('extensions', async ({ signedIn: page }) => {
	await ready(page, '/settings/extensions');
	await expect(
		page
			.getByRole('main')
			.getByText(/parity-panel-counter/i)
			.first(),
	).toBeVisible();
	await shot(page, 'extensions-1');
});
