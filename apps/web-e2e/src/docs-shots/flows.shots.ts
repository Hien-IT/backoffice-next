// Spec 033 (T078): the screenshots of the guide page `guides/flows`.
import { expect, ready, shot, test } from './shot.js';

test('flows', async ({ signedIn: page, data }) => {
	await ready(page, `/settings/flows/${data.flowId}`);
	await expect(page.locator('[data-panel-key="kiem_tra_ton"]')).toBeVisible();
	await expect(page.locator('[data-panel-key="ghi_log"]')).toBeVisible();
	await shot(page, 'flows-1');
});
