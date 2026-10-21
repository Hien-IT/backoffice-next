// Ported from directus/app/src/stores/settings.ts
// Backoffice: hydrate, setOwner (the API writes the owner without the owner report, D-38) and updateSettings with the
// in-place notice (D-66, added by 016); the AI providers getter is left out (D-41).
import type { OwnerInformation } from '@directus/types';
import { merge } from 'lodash-es';
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { notify, showUnexpectedError } from '../composables/use-notices.ts';
import type { ModuleBarPart } from '../constants.ts';
import { i18n } from '../lang/index.ts';
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
	getters: {
		/** Spec 020 (FR-079): no AI providers in Backoffice (Principle XI). */
		availableAiProviders: (): string[] => [],
	},
	actions: {
		async hydrate() {
			const userStore = useUserStore();
			if (!userStore.currentUser || 'share' in userStore.currentUser) return;

			this.settings = await sdk.request(requestEndpoint<Settings>('/settings', { method: 'GET' }));
		},

		async dehydrate() {
			this.$reset();
		},

		async setOwner(owner: OwnerInformation) {
			try {
				await sdk.request(requestEndpoint('/settings/owner', { method: 'POST', body: owner }));
			} catch (error) {
				showUnexpectedError(error);
			}
		},

		async updateSettings(updates: { [key: string]: any }, notifyOnSuccess = true) {
			const settingsCopy = { ...(this.settings as Settings) };
			const newSettings = merge({}, this.settings, updates);

			this.settings = newSettings;

			try {
				this.settings = await sdk.request(requestEndpoint<Settings>('/settings', { method: 'PATCH', body: updates }));

				if (notifyOnSuccess) notify({ title: i18n.global.t('settings_update_success'), type: 'success' });
			} catch (error) {
				this.settings = settingsCopy;
				showUnexpectedError(error);
			}
		},
	},
});
