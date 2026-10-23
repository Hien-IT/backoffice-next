// DR has no test for add-new.vue: the dialog opens with its route, uploads into the folder with the allowed
// types of the server, emits `upload` and goes back to the folder (FR-020).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import { useServerStore } from '../../../stores/server.ts';
import { mockApi } from '../../../test-utils/fetch.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import AddNewFile from './AddNewFile.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => replaceQueue());

const routes = [
	{ path: '/files', name: 'files-collection', component: { render: () => null } },
	{ path: '/files/folders/:folder', name: 'folders-collection', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

test('open with the route: multiple upload into the folder, the server types, then back to the folder', async () => {
	const fetch = mockApi({ 'POST /files': { id: 'f1' } });
	const { wrapper, router } = await mountLayout(AddNewFile, {
		props: { folder: 'd1' },
		routes,
		path: '/files/folders/d1/+',
		beforeMount() {
			useServerStore().info.files = { mimeTypeAllowList: ['image/*', 'application/pdf'] };
		},
	});

	const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="file"]')!;
	expect(input.multiple).toBe(true);
	expect(input.accept).toBe('image/*,application/pdf');

	Object.defineProperty(input, 'files', { value: [new File(['a'], 'a.png', { type: 'image/png' })], configurable: true });
	input.dispatchEvent(new Event('input'));
	await flushPromises();

	const body = fetch.mock.calls[0]![1]!.body as FormData;
	expect(body.get('folder')).toBe('d1');
	expect(wrapper.emitted('upload')).toHaveLength(1);
	expect(router.currentRoute.value.fullPath).toBe('/files/folders/d1');
});

test('Done closes to the library without a folder', async () => {
	mockApi({});
	const { router } = await mountLayout(AddNewFile, { routes, path: '/files/+' });

	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === 'Done')!.click();
	await flushPromises();

	expect(router.currentRoute.value.fullPath).toBe('/files');
});
