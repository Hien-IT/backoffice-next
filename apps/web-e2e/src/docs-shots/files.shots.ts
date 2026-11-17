// Spec 033 (T072): the screenshots of the guide page `guides/files`.
import { expect, ready, shot, test } from './shot.js';

test('files', async ({ signedIn: page, data }) => {
	await ready(page, `/files/folders/${data.folderId}`);
	await expect(page.getByRole('main').locator('img').first()).toBeVisible();
	await shot(page, 'files-1');

	// The grayscale picture keeps the file under the 300 KB limit of FR-034 (research R10).
	await ready(page, `/files/${data.fileIds[2]}`);
	await expect(page.getByRole('main').locator('img').first()).toBeVisible();
	await shot(page, 'files-2', {
		mask: [page.locator('[data-field="uploaded_on"], [data-field="modified_on"], [data-field="created_on"]')],
	});
});
