// Ported from directus/app/src/composables/use-clipboard.test.ts
// Backoffice: the composable does not notify (no snackbars before 018), so the notify mock and i18n are gone.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, unref } from 'vue';
import { useClipboard } from './use-clipboard.ts';

const global = {};

const testComponent = defineComponent({
	setup() {
		return useClipboard();
	},
	render: () => h('div'),
});

describe('useClipboard', () => {
	afterEach(() => {
		vi.resetAllMocks();
	});

	test.each([
		{ value: { writeText: vi.fn() }, expectedResult: true },
		{ value: {}, expectedResult: false },
	])('isCopySupported should be $expectedResult', ({ value, expectedResult }) => {
		Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

		const wrapper = mount(testComponent, { global });

		expect(unref(wrapper.vm.isCopySupported)).toBe(expectedResult);
	});

	test.each([
		{ value: { readText: vi.fn() }, expectedResult: true },
		{ value: {}, expectedResult: false },
	])('isPasteSupported should be $expectedResult', ({ value, expectedResult }) => {
		Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

		const wrapper = mount(testComponent, { global });

		expect(unref(wrapper.vm.isPasteSupported)).toBe(expectedResult);
	});

	test('copyToClipboard with string value returns true', async () => {
		Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true });
		const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
		const copyValue = 'test';

		const wrapper = mount(testComponent, { global });

		const isCopied = await wrapper.vm.copyToClipboard(copyValue);

		expect(writeTextSpy).toHaveBeenCalledWith(copyValue);
		expect(isCopied).toBe(true);
	});

	test('copyToClipboard with json value stringifies it and returns true', async () => {
		Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true });
		const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
		const copyValue = { test: 'value' };

		const wrapper = mount(testComponent, { global });

		const isCopied = await wrapper.vm.copyToClipboard(copyValue);

		expect(writeTextSpy).toHaveBeenCalledWith(JSON.stringify(copyValue));
		expect(isCopied).toBe(true);
	});

	test('copyToClipboard returns false when it fails', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: vi.fn().mockImplementation(() => Promise.reject()) },
			configurable: true,
		});

		const copyValue = 'test';

		const wrapper = mount(testComponent, { global });

		const isCopied = await wrapper.vm.copyToClipboard(copyValue);

		expect(isCopied).toBe(false);

		consoleSpy.mockRestore();
	});

	test('pasteFromClipboard returns string when it succeeds', async () => {
		const testClipboardValue = 'test';

		Object.defineProperty(navigator, 'clipboard', {
			value: { readText: vi.fn().mockReturnValue(testClipboardValue) },
			configurable: true,
		});

		const wrapper = mount(testComponent, { global });

		const clipboardValue = await wrapper.vm.pasteFromClipboard();

		expect(clipboardValue).toBe(testClipboardValue);
	});

	test('pasteFromClipboard returns null when it fails', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		Object.defineProperty(navigator, 'clipboard', {
			value: { readText: vi.fn().mockImplementation(() => Promise.reject()) },
			configurable: true,
		});

		const wrapper = mount(testComponent, { global });

		const clipboardValue = await wrapper.vm.pasteFromClipboard();

		expect(clipboardValue).toBe(null);

		consoleSpy.mockRestore();
	});
});
