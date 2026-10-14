// Ported from directus/app/src/stores/settings.ts
// Backoffice: only hydrate and updateSettings (without the notification, feature 016 adds it); setOwner and the AI
// providers getter are left out (D-38, D-41).
import { merge } from 'lodash-es';
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import type { ModuleBarPart } from '../constants.ts';
import { useUserStore } from './user.ts';

export type Settings = {
	project_name: string | null;
	project_url: string | null;
	project_color: string | null;
	project_logo: string | null;
	module_bar: ModuleBarPart[] | null;
	[field: string]: unknown;
};

export const useSettingsStore = defineStore('settingsStore', {
	state: () => ({
		settings: null as null | Settings,
	}),
	actions: {
		async hydrate() {
			const userStore = useUserStore();
			if (!userStore.currentUser || 'share' in userStore.currentUser) return;

			this.settings = await sdk.request(requestEndpoint<Settings>('/settings', { method: 'GET' }));
		},

		async dehydrate() {
			this.$reset();
		},

		async updateSettings(updates: { [key: string]: any }) {
			const settingsCopy = { ...(this.settings as Settings) };
			const newSettings = merge({}, this.settings, updates);

			this.settings = newSettings;

			try {
				this.settings = await sdk.request(requestEndpoint<Settings>('/settings', { method: 'PATCH', body: updates }));
			} catch (error) {
				this.settings = settingsCopy;
				throw error;
			}
		},
	},
});
