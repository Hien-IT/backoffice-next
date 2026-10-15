import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import { NOTICE_TIMEOUT, notify, resetNotices, showUnexpectedError, useNotices } from '../composables/use-notices.ts';
import NoticeStack from './NoticeStack.vue';

beforeEach(() => {
	resetNotices();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

const mountStack = () => mount(NoticeStack, { global: { plugins: [i18n] }, attachTo: document.body });

test('a notice shows under the page header and goes away after 3 s like Directus', async () => {
	const wrapper = mountStack();

	notify({ title: 'Item updated' });
	await flushPromises();
	expect(wrapper.get('[role="status"][aria-live="polite"]').text()).toContain('Item updated');

	vi.advanceTimersByTime(NOTICE_TIMEOUT);
	await flushPromises();
	// The live region stays in the page (design owner, 2026-10-15); the notice is gone.
	expect(wrapper.get('[aria-live="polite"]').text()).toBe('');
});

test('a persistent notice stays until it is dismissed', async () => {
	const wrapper = mountStack();

	notify({ title: 'Export started', persist: true });
	vi.advanceTimersByTime(NOTICE_TIMEOUT * 2);
	await flushPromises();
	expect(useNotices().queue.value).toHaveLength(1);

	await wrapper.get('button[aria-label="Dismiss"]').trigger('click');
	expect(useNotices().queue.value).toHaveLength(0);
});

test('an unexpected error opens a dialog with the translated title and the code', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	mountStack();

	showUnexpectedError({ errors: [{ message: 'You do not have permission', extensions: { code: 'FORBIDDEN' } }] });
	await flushPromises();

	const dialog = document.body.querySelector('[role="dialog"]')!;
	expect(dialog.textContent).toContain(i18n.global.t('errors.FORBIDDEN'));
	expect(dialog.textContent).toContain('[FORBIDDEN] You do not have permission');

	vi.advanceTimersByTime(NOTICE_TIMEOUT * 2);
	expect(useNotices().dialogs.value).toHaveLength(1);
});
