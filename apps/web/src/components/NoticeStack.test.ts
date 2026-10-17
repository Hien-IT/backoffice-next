import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import { NOTICE_TIMEOUT, notify, resetNotices, showUnexpectedError, useNotices } from '../composables/use-notices.ts';
import NoticeStack from './NoticeStack.vue';

beforeEach(() => {
	resetNotices();
	vi.useFakeTimers();
});

const mounted: ReturnType<typeof mount>[] = [];

afterEach(() => {
	vi.useRealTimers();
	resetNotices();
	mounted.splice(0).forEach((wrapper) => wrapper.unmount());
	document.body.innerHTML = '';
});

const mountStack = () => {
	const wrapper = mount(NoticeStack, { global: { plugins: [i18n] }, attachTo: document.body });
	mounted.push(wrapper);
	return wrapper;
};

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

// Spec 018 T100 (FR-081, D-109): the error dialog has Dismiss as its only action (no "Report error"), Dismiss takes the
// focus and closes it; an error without a code shows the translated UNKNOWN title.
test('error dialog: Dismiss only, focused, closes; an error without a code is UNKNOWN', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	mountStack();

	showUnexpectedError(new Error('boom'));
	await flushPromises();
	vi.advanceTimersByTime(50);
	await flushPromises();

	const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
	expect(dialog.textContent).toContain(i18n.global.t('errors.UNKNOWN'));
	expect(dialog.textContent).not.toMatch(/report/i);
	const dismiss = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Dismiss')!;
	expect(document.activeElement).toBe(dismiss);

	dismiss.click();
	await flushPromises();
	expect(useNotices().dialogs.value).toHaveLength(0);
});
