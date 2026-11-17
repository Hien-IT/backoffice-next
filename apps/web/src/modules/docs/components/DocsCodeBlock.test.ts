// Spec 033 T023 (FR-010a, FR-046, contracts/web.md §3).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetNotices, useNotices } from '../../../composables/use-notices.ts';
import { i18n } from '../../../lang/index.ts';
import DocsCodeBlock from './DocsCodeBlock.vue';

enableAutoUnmount(afterEach);

const writeText = vi.fn();

beforeEach(() => {
	writeText.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => resetNotices());

const block = (props: { code: string; language?: string | null }) => mount(DocsCodeBlock, { props, global: { plugins: [i18n] } });

test('a known language is highlighted; the block is reachable by keyboard', () => {
	const wrapper = block({ code: '{"a": 1}', language: 'json' });

	expect(wrapper.find('pre').attributes('tabindex')).toBe('0');
	expect(wrapper.find('code').attributes('data-lang')).toBe('json');
	expect(wrapper.find('.hljs-attr').exists()).toBe(true);
	expect(wrapper.find('code').text()).toBe('{"a": 1}');
});

test('without a language the code is plain text; markup in it never becomes an element (FR-046)', () => {
	const wrapper = block({ code: '<img src=x onerror=alert(1)>' });

	expect(wrapper.find('img').exists()).toBe(false);
	expect(wrapper.find('code').text()).toBe('<img src=x onerror=alert(1)>');
	expect(wrapper.find('code').attributes('data-lang')).toBeUndefined();
});

test('copy takes the source text and announces the result', async () => {
	const wrapper = block({ code: 'curl "https://backoffice.example.com/items"', language: 'bash' });

	await wrapper.find('button.docs-copy').trigger('click');
	await flushPromises();

	expect(writeText).toHaveBeenCalledWith('curl "https://backoffice.example.com/items"');
	expect(wrapper.find('[aria-live="polite"]').text()).toBe('Copied');
});

test('a clipboard error is a notice, nothing is announced', async () => {
	writeText.mockRejectedValue(new Error('denied'));
	const wrapper = block({ code: 'x' });

	await wrapper.find('button.docs-copy').trigger('click');
	await flushPromises();

	expect(wrapper.find('[aria-live="polite"]').text()).toBe('');
	expect(useNotices().queue.value.map((notice) => [notice.type, notice.title])).toEqual([
		['error', 'Could not copy to the clipboard.'],
	]);
});
