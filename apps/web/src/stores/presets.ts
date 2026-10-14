// Ported from directus/app/src/stores/presets.ts
// Backoffice: only hydrate/dehydrate; the system default presets and the preset actions come with feature 014+
// (D-45).
import { defineStore } from 'pinia';
import { fetchAll } from '../utils/fetch-all.ts';
import { useUserStore } from './user.ts';

export const usePresetsStore = defineStore('presetsStore', {
	state: () => ({
		collectionPresets: [] as Record<string, any>[],
	}),
	actions: {
		async hydrate() {
			const userStore = useUserStore();
			if (!userStore.currentUser || 'share' in userStore.currentUser) return;

			// Hydrate is only called for logged in users, therefore, currentUser exists
			const { id, role } = userStore.currentUser;

			const values = await Promise.all([
				// All user saved bookmarks and presets
				fetchAll<any>(`/presets`, {
					params: {
						'filter[user][_eq]': id,
					},
				}),
				role?.id // All role saved bookmarks and presets
					? fetchAll<any>(`/presets`, {
							params: {
								'filter[role][_eq]': role.id,
								'filter[user][_null]': true,
							},
						})
					: Promise.resolve([]),
				// All global saved bookmarks and presets
				fetchAll<any>(`/presets`, {
					params: {
						'filter[role][_null]': true,
						'filter[user][_null]': true,
					},
				}),
			]);

			this.collectionPresets = values.flat();
		},
		async dehydrate() {
			this.$reset();
		},
	},
});
