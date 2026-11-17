// Spec 033 (T075): the screenshots of the guide page `guides/activity-notifications`.
import { expect, ready, shot, test } from './shot.js';

test('activity and notifications', async ({ signedIn: page }) => {
	await ready(page, '/activity');
	// Only the "create" rows: sign-ins and updates come with every run, the rows created by the sample data do not.
	await page.locator('aside#navigation').getByRole('button', { name: 'Tạo', exact: true }).click();
	await expect(page.getByRole('main').getByRole('table').locator('tbody tr').first()).toBeVisible();
	await page.waitForLoadState('networkidle');
	// The time column changes with every run: masked (FR-037).
	await shot(page, 'activity-notifications-1', { mask: [page.locator('main table tbody td:nth-child(3)')] });

	await page
		.locator('aside#navigation')
		.getByRole('button', { name: /^Thông báo/ })
		.click();
	await expect(page.getByText('Sản phẩm Váy hoa nhí sắp hết hàng').first()).toBeVisible();
	await shot(page, 'activity-notifications-2', {
		mask: [page.locator('main table tbody td:nth-child(3)'), page.getByText(/(giây|phút|giờ|ngày) trước$/)],
	});
});
