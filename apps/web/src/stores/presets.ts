// Ported from directus/app/src/stores/presets.ts
// Backoffice: hydrate/dehydrate and getPresetForCollection; the system default presets, bookmarks and the preset
// actions come with feature 014+ (D-45).
import type { Preset } from '@directus/types';
import { defineStore } from 'pinia';
import { fetchAll } from '../utils/fetch-all.ts';
import { useUserStore } from './user.ts';

const defaultPreset: Omit<Preset, 'collection'> = {
	bookmark: null,
	role: null,
	user: null,
	search: null,
	filter: null,
	layout: null,
	layout_query: null,
	layout_options: null,
	refresh_interval: null,
	icon: 'bookmark',
	color: null,
};

export const usePresetsStore = defineStore('presetsStore', {
	state: () => ({
		collectionPresets: [] as Preset[],
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

		/**
		 * Retrieves the most specific preset that applies to the given collection for the current
		 * user. If the user doesn't have a preset for this collection, it will fallback to the
		 * role and collection presets respectively.
		 */
		getPresetForCollection(collection: string) {
			const userStore = useUserStore();

			if (userStore.currentUser === null) return null;
			if (!('id' in userStore.currentUser)) return null;

			const { id: userID, role: userRole } = userStore.currentUser;

			const defaultPresetWithCollection = {
				...defaultPreset,
				collection: collection,
				user: userID,
			};

			const availablePresets = this.collectionPresets.filter((preset) => {
				const userMatches = preset.user === userID || preset.user === null;
				const roleMatches = preset.role === userRole?.id || preset.role === null;
				const collectionMatches = preset.collection === collection;

				// Filter out all bookmarks
				if (preset.bookmark) return false;

				if (userMatches && collectionMatches) return true;
				if (roleMatches && collectionMatches) return true;
				return false;
			});

			if (availablePresets.length === 0) return defaultPresetWithCollection;
			if (availablePresets.length === 1) return availablePresets[0];

			// In order of specificity: user-role-collection
			const userPreset = availablePresets.find((preset) => preset.user === userID);
			if (userPreset) return userPreset;

			const rolePreset = availablePresets.find((preset) => preset.role === userRole?.id);
			if (rolePreset) return rolePreset;

			// If the other two already came up empty, we can assume there's only one preset. That
			// being said, as a safety precaution, we'll use the last saved preset in case there are
			// duplicates in the DB
			const collectionPreset = availablePresets[availablePresets.length - 1];
			return collectionPreset;
		},
	},
});
