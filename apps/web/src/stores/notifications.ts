// Ported from directus/app/src/stores/notifications.ts
// Backoffice: the drawer (018) lists the notifications itself; there are no snackbars: `queue`, `dialogs` and the
// add/hide/remove/update actions are those of the in-place notices (use-notices, D-66), kept for app extensions
// (spec 020, FR-079).
import type { Notification } from '@directus/types';
import { reverse, sortBy } from 'lodash-es';
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { type Notice, type NoticeRaw, notify, remove, useNotices } from '../composables/use-notices.ts';
import { useUserStore } from './user.ts';

const notices = useNotices();

export const useNotificationsStore = defineStore('notificationsStore', {
	state: () => ({
		previous: [] as Notice[],
		notifications: [] as Notification[],
		unread: 0,
		overlayIsActive: false,
	}),
	getters: {
		queue: (): Notice[] => notices.queue.value,
		dialogs: (): Notice[] => notices.dialogs.value,
		lastFour(): Notice[] {
			const all = [...this.queue, ...this.previous.filter((notice) => notice.dialog !== true)];
			return reverse(reverse(sortBy(all, ['timestamp'])).slice(0, 4));
		},
	},
	actions: {
		async hydrate() {
			const userStore = useUserStore();

			if (userStore.currentUser && !('share' in userStore.currentUser)) {
				await this.refreshUnreadCount();
			}
		},
		async dehydrate() {
			this.$reset();
		},
		async refreshUnreadCount() {
			const userStore = useUserStore();

			if (!userStore.currentUser || !('id' in userStore.currentUser)) return;

			const countResponse = await sdk.request(
				requestEndpoint<{ count: { id: number | string } }[]>('/notifications', {
					method: 'GET',
					params: {
						filter: {
							_and: [
								{
									recipient: {
										_eq: userStore.currentUser.id,
									},
								},
								{
									status: {
										_eq: 'inbox',
									},
								},
							],
						},
						aggregate: {
							count: 'id',
						},
					},
				}),
			);

			this.unread = Number(countResponse[0]?.count.id ?? 0);
		},
		setUnreadCount(count: number) {
			this.unread = count < 0 ? 0 : count;
		},
		setOverlayIsActive(active: boolean) {
			this.overlayIsActive = active;
		},
		add(notification: NoticeRaw): string {
			return notify(notification);
		},
		hide(id: string) {
			const notice = [...this.queue, ...this.dialogs].find((notice) => notice.id === id);
			if (!notice) return;
			remove(id);
			this.previous = [...this.previous, notice];
		},
		remove(id: string) {
			remove(id);
		},
		update(id: string, updates: Partial<Notice>) {
			const updateIfNeeded = (notice: Notice) => (notice.id === id ? { ...notice, ...updates } : notice);
			notices.queue.value = notices.queue.value.map(updateIfNeeded);
			notices.dialogs.value = notices.dialogs.value.map(updateIfNeeded);
			this.previous = this.previous.map(updateIfNeeded);
		},
	},
});
