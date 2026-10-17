// Ported from directus/app/src/stores/notifications.ts
// Backoffice: only the unread count; the drawer (018) lists the notifications itself, and there are no snackbars or
// dialogs here: notices stay in place (use-notices, D-66).
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useUserStore } from './user.ts';

export const useNotificationsStore = defineStore('notificationsStore', {
	state: () => ({
		unread: 0,
	}),
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
	},
});
