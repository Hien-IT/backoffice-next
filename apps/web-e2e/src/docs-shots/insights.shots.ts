// Spec 033 (T074): the screenshots of the guide page `guides/insights`.
import { expect, ready, shot, test } from './shot.js';

test('insights', async ({ signedIn: page, data }) => {
	await ready(page, `/insights/${data.dashboardId}`);
	await expect(page.locator('[data-panel-type="metric"]').first()).toContainText(/\d/);
	await expect(page.locator('[data-panel-type="list"]')).toContainText('Khăn len');
	await shot(page, 'insights-1');
});
