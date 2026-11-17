// Spec 033 (T084): the screenshots of the guide page `guides/passkey`.
import { expect, ready, shot, test } from './shot.js';
import { L } from './lang.js';

test('passkey: the sign-in page', async ({ page }) => {
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: /passkey/i })).toBeVisible();
	await shot(page, 'passkey-1');
});

test('passkey: the card of the own user page', async ({ signedIn: page, data }) => {
	await ready(page, `/users/${data.adminId}`);
	const card = page
		.getByRole('heading', { name: L('Passkey'), exact: true })
		.locator('xpath=ancestor::*[contains(@class, "rounded-2xl")][1]');
	await card.scrollIntoViewIfNeeded();
	await expect(card).toBeVisible();
	await shot(page, 'passkey-2', { of: card });
});
