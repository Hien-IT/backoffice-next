// DR has no test for file-info-sidebar-detail.vue: rows from the file, the owner and folder requests, the EXIF
// rows of the fixture JPEG, a failing owner request that leaves its row out (CHK013).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import { useSidebarStore } from '../../../layout/stores/sidebar.ts';
import { mockApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import FileInfoSidebarDetail from './FileInfoSidebarDetail.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => replaceQueue());

const exif = loadSnapshot().directoryFiles.find((f) => f['title'] === 'bo-exif')!;

async function setup(answers: Record<string, unknown>, file: Record<string, unknown> = exif) {
	const fetch = mockApi(answers as never);
	const mounted = await mountLayout(FileInfoSidebarDetail, {
		props: { file: { ...file, uploaded_by: 'u1', modified_by: null, created_on: '2026-10-16T10:00:00.000Z' }, isNew: false },
		beforeMount() {
			useSidebarStore().activeAccordionItem = 'file-info';
		},
	});
	await flushPromises();
	return { ...mounted, fetch };
}

test('type, dimensions, size, owner, folder link and the EXIF rows', async () => {
	const { wrapper, fetch } = await setup({
		'GET /users/u1': { id: 'u1', first_name: 'Ada', last_name: 'Active', email: 'a@x' },
		[`GET /folders/${exif['folder']}`]: { id: exif['folder'], name: 'bo-files' },
	});

	const text = wrapper.text();
	expect(text).toContain('JPG');
	expect(text).toContain('64 × 48');
	expect(text).toContain('Ada Active');
	expect(text).toContain('bo-files');
	expect(text).toContain('Backoffice Fixture Cam');
	expect(text).toContain('ƒ/2.8');
	expect(text).toContain('1/125');
	expect(text).toContain('50mm');
	expect(text).toContain('200');
	expect(wrapper.find(`a[href="/files/folders/${exif['folder']}"]`).exists()).toBe(true);

	const userCall = fetch.mock.calls.find(([url]) => String(url).includes('/users/u1'))!;
	expect(decodeURIComponent(String(userCall[0]))).toContain('fields=id,email,first_name,last_name,role');
});

test('a failing owner request leaves the owner row out; no folder is the library', async () => {
	const { wrapper } = await setup({}, { ...exif, folder: null });

	expect(wrapper.text()).not.toContain('Owner');
	expect(wrapper.get('a[href="/files"]').text()).toContain('File Library');
});
