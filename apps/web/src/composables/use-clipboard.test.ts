// Feature 015: useClipboard as directus/app/src/composables/use-clipboard.ts, notices in place (D-66).
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { i18n } from '../lang/index.ts';
import { resetNotices, useNotices } from './use-notices.ts';
import { useClipboard } from './use-clipboard.ts';

let clipboard: ReturnType<typeof useClipboard>;

const Host = defineComponent({
	setup() {
		clipboard = useClipboard();
		return () => null;
	},
});

beforeEach(() => {
	resetNotices();
	mount(Host, { global: { plugins: [i18n] } });
});

afterEach(() => vi.unstubAllGlobals());

test('copies a string or JSON and notifies the success message', async () => {
	const writeText = vi.fn(async () => undefined);
	vi.stubGlobal('navigator', { clipboard: { writeText } });

	expect(await clipboard.copyToClipboard('abc', { success: 'Copied' })).toBe(true);
	expect(await clipboard.copyToClipboard({ a: 1 })).toBe(true);

	expect(writeText.mock.calls).toEqual([['abc'], ['{"a":1}']]);
	expect(useNotices().queue.value.map((n) => n.title)).toEqual(['Copied', i18n.global.t('copy_raw_value_success')]);
});

test('a refused copy notifies the failure as an error', async () => {
	vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('no'))) } });

	expect(await clipboard.copyToClipboard('abc', { fail: 'Could not copy' })).toBe(false);
	expect(useNotices().queue.value).toMatchObject([{ type: 'error', title: 'Could not copy' }]);
});

test('isCopySupported follows navigator.clipboard', () => {
	vi.stubGlobal('navigator', {});
	expect(clipboard.isCopySupported.value).toBe(false);
});
