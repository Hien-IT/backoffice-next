// Ported from directus/app/src/composables/use-system.ts
// Backoffice (spec 020, FR-079): the four injects of @directus/extensions-sdk (useStores, useApi, useSdk,
// useExtensions); the injection keys are those of @directus/constants (copied: the web app does not depend on it).
import type { App } from 'vue';
import api from '../api/axios.ts';
import { sdk } from '../api/sdk.ts';
import { useExtensions } from '../extensions.ts';
import { useAppStore } from '../stores/app.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { useInsightsStore } from '../stores/insights.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { usePermissionsStore } from '../stores/permissions.ts';
import { usePresetsStore } from '../stores/presets.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { useRequestsStore } from '../stores/requests.ts';
import { useServerStore } from '../stores/server.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useTranslationsStore } from '../stores/translations.ts';
import { useUserStore } from '../stores/user.ts';

export const STORES_INJECT = 'stores';
export const API_INJECT = 'api';
export const SDK_INJECT = 'sdk';
export const EXTENSIONS_INJECT = 'extensions';

export function useSystem(app: App): void {
	app.provide(STORES_INJECT, {
		useAppStore,
		useCollectionsStore,
		useFieldsStore,
		useFlowsStore,
		useInsightsStore,
		useNotificationsStore,
		usePermissionsStore,
		usePresetsStore,
		useRelationsStore,
		useRequestsStore,
		useServerStore,
		useSettingsStore,
		useTranslationsStore,
		useUserStore,
	});

	app.provide(API_INJECT, api);

	// The SDK client is created after config.json loads (main.ts), before this runs.
	app.provide(SDK_INJECT, sdk);

	app.provide(EXTENSIONS_INJECT, useExtensions());
}
