// Spec 033 (T073): the screenshots of the guide page `guides/users`.
import { expect, ready, shot, test } from './shot.js';

test('users', async ({ signedIn: page, data }) => {
	await ready(page, '/users');
	await expect(page.getByRole('main').getByText('lan.nguyen@example.com')).toBeVisible();
	await shot(page, 'users-1', { mask: [page.locator('main [data-field="last_access"]')] });

	await ready(page, `/users/${data.userIds[0]}`);
	await expect(page.getByRole('main').getByText('lan.nguyen@example.com').first()).toBeVisible();
	await shot(page, 'users-2', {
		mask: [page.locator('main [data-field="last_access"], main [data-field="last_page"]')],
	});
});
