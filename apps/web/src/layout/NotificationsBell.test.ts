// Spec 018 US6 (T090; FR-070, recipe Q-38): the header bell shows the unread count of the notifications store (hidden at
// 0, the button stays usable), names the count in its aria-label, announces a changed count in a polite live region and
// opens the notifications drawer.
import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { useAppStore } from '../stores/app.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { mountLayout } from '../test-utils/layout.ts';
import NotificationsBell from './NotificationsBell.vue';

enableAutoUnmount(afterEach);

const bell = () => document.querySelector<HTMLButtonElement>('button')!;
const badge = () => document.querySelector('[data-testid="notifications-badge"]');
const live = () => document.querySelector('[aria-live="polite"]')!;

test('badge from the store, hidden at 0, aria-label with the count, live region on change, click opens the drawer', async () => {
	await mountLayout(NotificationsBell, { beforeMount: () => void (useNotificationsStore().unread = 3) });

	expect(badge()!.textContent!.trim()).toBe('3');
	expect(badge()!.getAttribute('aria-hidden')).toBe('true');
	expect(bell().getAttribute('aria-label')).toBe('Notifications, 3 unread');
	// Not announced on load.
	expect(live().textContent).toBe('');
	expect(live().classList).toContain('sr-only');

	useNotificationsStore().unread = 2;
	await nextTick();
	expect(badge()!.textContent!.trim()).toBe('2');
	expect(live().textContent).toBe('Notifications, 2 unread');

	useNotificationsStore().unread = 0;
	await nextTick();
	expect(badge()).toBeNull();
	expect(bell().disabled).toBe(false);
	expect(bell().getAttribute('aria-label')).toBe('Notifications, 0 unread');

	bell().click();
	expect(useAppStore().notificationsDrawerOpen).toBe(true);
});

test('more than 99 shows 99+, the label keeps the number', async () => {
	await mountLayout(NotificationsBell, { beforeMount: () => void (useNotificationsStore().unread = 120) });

	expect(badge()!.textContent!.trim()).toBe('99+');
	expect(bell().getAttribute('aria-label')).toBe('Notifications, 120 unread');
});

// D-116 (owner 2026-10-18): the count is recounted when the browser tab becomes visible again, at most once a minute.
test('the unread count is recounted when the tab becomes visible, throttled', async () => {
	let refresh!: ReturnType<typeof vi.spyOn>;
	await mountLayout(NotificationsBell, {
		beforeMount: () => {
			refresh = vi.spyOn(useNotificationsStore(), 'refreshUnreadCount').mockResolvedValue();
		},
	});
	const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

	document.dispatchEvent(new Event('visibilitychange'));
	document.dispatchEvent(new Event('visibilitychange'));
	expect(refresh).toHaveBeenCalledTimes(1);

	visible.mockRestore();
});

// An ended session makes the recount fail (401); that is no unhandled rejection (the auth refresh signs out).
test('a failed recount is swallowed', async () => {
	let refresh!: ReturnType<typeof vi.spyOn>;
	await mountLayout(NotificationsBell, {
		beforeMount: () => {
			refresh = vi.spyOn(useNotificationsStore(), 'refreshUnreadCount').mockRejectedValue({ errors: [] });
		},
	});
	const unhandled = vi.fn();
	process.on('unhandledRejection', unhandled);
	const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

	document.dispatchEvent(new Event('visibilitychange'));
	await new Promise((resolve) => setTimeout(resolve));
	expect(refresh).toHaveBeenCalledTimes(1);
	expect(unhandled).not.toHaveBeenCalled();

	visible.mockRestore();
	process.off('unhandledRejection', unhandled);
});
