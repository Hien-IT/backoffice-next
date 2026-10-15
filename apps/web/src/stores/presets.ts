// Ported from directus/app/src/stores/presets.ts
// Backoffice: no system default presets (directus_files, directus_users, directus_activity): their screens come with
// features 015 and 018 (D-40); the rest of the store is the Directus one (feature 014, FR-018).
import type { Preset } from '@directus/types';
import { cloneDeep, orderBy } from 'lodash-es';
import { nanoid } from 'nanoid';
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { fetchAll } from '../utils/fetch-all.ts';
import { useUserStore } from './user.ts';

const currentUpdate: Record<number, string> = {};

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
	getters: {
		bookmarks(): Preset[] {
			return orderBy(
				this.collectionPresets.filter((preset) => preset.bookmark !== null),
				[
					(preset) => preset.user === null && preset.role === null,
					(preset) => preset.user === null && preset.role !== null,
					'bookmark',
				],
			);
		},
	},
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
		async create(newPreset: Partial<Preset>) {
			const created = await sdk.request<Preset>(
				requestEndpoint('/presets', { method: 'POST', body: newPreset as Record<string, unknown> }),
			);

			this.collectionPresets.push(created);

			return created;
		},
		async update(id: number, updates: Partial<Preset>) {
			const updateID = nanoid();
			currentUpdate[id] = updateID;

			const updated = await sdk.request<Preset>(
				requestEndpoint(`/presets/${id}`, { method: 'PATCH', body: updates as Record<string, unknown> }),
			);

			if (currentUpdate[id] === updateID) {
				this.collectionPresets = this.collectionPresets.map((preset) => (preset.id === updated.id ? updated : preset));
			}

			return updated;
		},
		async delete(ids: number[]) {
			await sdk.request(requestEndpoint('/presets', { method: 'DELETE', body: ids }));

			this.collectionPresets = this.collectionPresets.filter((preset) => !ids.includes(preset.id!));
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

		getBookmark(bookmarkID: number) {
			return this.collectionPresets.find((preset) => preset.id === bookmarkID) || null;
		},

		/**
		 * Saves the given preset. If it's the default preset, it saves it as a new preset. If the
		 * preset already exists, but doesn't have a user associated, it will create a preset for
		 * the user. If the preset already exists and is for a user, we update the preset.
		 * The response gets added to the store.
		 */
		async savePreset(preset: Partial<Preset>) {
			const userStore = useUserStore();
			if (userStore.currentUser === null) return null;
			// Backoffice: a share session has no user id and never writes presets (FR-084).
			if (!('id' in userStore.currentUser)) return null;
			const { id: userID } = userStore.currentUser;

			// Clone the preset to make sure the future deletes don't affect the original object
			preset = cloneDeep(preset);

			if (preset.id === undefined || preset.id === null) {
				return await this.create({
					...preset,
					user: userID,
				});
			}

			if (preset.user !== userID) {
				if ('id' in preset) delete preset.id;

				return await this.create({
					...preset,
					user: userID,
				});
			} else {
				const id = preset.id;
				delete preset.id;
				return await this.update(id, preset);
			}
		},

		saveLocal(updatedPreset: Preset) {
			this.collectionPresets = this.collectionPresets.map((preset) => {
				if (preset.id === updatedPreset.id) {
					return { ...updatedPreset };
				}

				return preset;
			});
		},

		async clearLocalSave(preset: Preset) {
			const fresh = await sdk.request<Preset>(requestEndpoint(`/presets/${preset.id}`));

			this.collectionPresets = this.collectionPresets.map((existing) => (existing.id === fresh.id ? fresh : existing));
		},
	},
});
