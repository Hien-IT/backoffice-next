// Ported from directus/app/src/views/private/components/file-preview-replace.test.ts (behaviour), with our components:
// the replace button opens the upload dialog for this file and emits `replace` after the upload.
import { enableAutoUnmount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { calls, mockApi } from '../../test-utils/fetch.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import FilePreviewReplace from './FilePreviewReplace.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => replaceQueue());

const replaceButton = (wrapper: VueWrapper) => wrapper.findAll('button').find((b) => b.text().includes('Replace File'))!;

const file = { id: 'f1', title: 'A', type: 'image/png', modified_on: null, width: 1, height: 1 } as never;

test('replace uploads with PATCH /files/:id and emits replace', async () => {
	const fetch = mockApi({ 'PATCH /files/f1': { id: 'f1' } });
	const { wrapper } = await mountLayout(FilePreviewReplace, { props: { file } });

	await replaceButton(wrapper).trigger('click');
	await flushPromises();

	const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="file"]')!;
	Object.defineProperty(input, 'files', { value: [new File(['b'], 'b.png', { type: 'image/png' })], configurable: true });
	input.dispatchEvent(new Event('input'));
	await flushPromises();

	expect(calls(fetch)).toEqual(['PATCH /files/f1']);
	expect(wrapper.emitted('replace')).toHaveLength(1);
	expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('no replace button for a non-editable preview; disabled without update', async () => {
	mockApi({});
	const nonEditable = await mountLayout(FilePreviewReplace, { props: { file, nonEditable: true } });
	expect(nonEditable.wrapper.text()).not.toContain('Replace File');
	nonEditable.wrapper.unmount();

	const disabled = await mountLayout(FilePreviewReplace, { props: { file, disabled: true } });
	expect(replaceButton(disabled.wrapper).attributes('disabled')).toBeDefined();
});
