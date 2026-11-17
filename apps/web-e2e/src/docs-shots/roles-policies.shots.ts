// Spec 033 (T077): the screenshots of the guide page `guides/roles-policies`.
import { expect, ready, shot, test } from './shot.js';
import { L } from './lang.js';

test('roles and policies', async ({ signedIn: page, data }) => {
	await ready(page, `/settings/roles/${data.roleId}`);
	await expect(page.getByRole('main').getByText(L('Biên tập')).first()).toBeVisible();
	await shot(page, 'roles-policies-1');

	await ready(page, `/settings/policies/${data.policyId}`);
	await expect(page.getByRole('main').getByText('products').first()).toBeVisible();
	await shot(page, 'roles-policies-2');
});
