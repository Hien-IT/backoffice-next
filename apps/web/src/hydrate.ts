// Ported from directus/app/src/hydrate.ts
// Backoffice: the AI store is not loaded (D-54); the insights store is loaded since feature 018 (D-45 lifted); modules
// are registered here instead of through the extensions (no app extensions, D-41).
import { setLanguage } from './lang/set-language.ts';
import { onDehydrateModules, onHydrateModules } from './modules/index.ts';
import { useAppStore } from './stores/app.ts';
import { useCollectionsStore } from './stores/collections.ts';
import { useFieldsStore } from './stores/fields.ts';
import { useFlowsStore } from './stores/flows.ts';
import { useInsightsStore } from './stores/insights.ts';
import { useNotificationsStore } from './stores/notifications.ts';
import { usePermissionsStore } from './stores/permissions.ts';
import { usePresetsStore } from './stores/presets.ts';
import { useRelationsStore } from './stores/relations.ts';
import { useRequestsStore } from './stores/requests.ts';
import { useServerStore } from './stores/server.ts';
import { useSettingsStore } from './stores/settings.ts';
import { useUserStore } from './stores/user.ts';
import { getBasemapSources } from './utils/geometry/basemap.ts';

type GenericStore = {
	$id: string;
	hydrate?: () => Promise<void>;
	dehydrate?: () => Promise<void> | void;

	[key: string]: any;
};

export function useStores(
	stores: (() => unknown)[] = [
		useCollectionsStore,
		useFieldsStore,
		useUserStore,
		useRequestsStore,
		usePresetsStore,
		useSettingsStore,
		useServerStore,
		useRelationsStore,
		usePermissionsStore,
		useInsightsStore,
		useFlowsStore,
		useNotificationsStore,
	],
): GenericStore[] {
	return stores.map((useStore) => useStore()) as GenericStore[];
}

export async function hydrate(): Promise<void> {
	const stores = useStores();

	const appStore = useAppStore();
	const userStore = useUserStore();
	const permissionsStore = usePermissionsStore();
	const fieldsStore = useFieldsStore();

	if (appStore.hydrated) return;
	if (appStore.hydrating) return;

	appStore.hydrating = true;

	try {
		/**
		 * @NOTE
		 * Multiple stores rely on the userStore to be set, so they can fetch user specific data. The
		 * following makes sure that the user store is always fetched first, before we hydrate anything
		 * else.
		 */
		await userStore.hydrate();

		const currentUser = userStore.currentUser;

		if (currentUser?.app_access) {
			await Promise.all([permissionsStore.hydrate(), fieldsStore.hydrate({ skipTranslation: true })]);

			const hydratedStores = ['userStore', 'permissionsStore', 'fieldsStore', 'serverStore'];
			await Promise.all(stores.filter(({ $id }) => !hydratedStores.includes($id)).map((store) => store.hydrate?.()));

			await onHydrateModules();
		} else if (currentUser && 'share' in currentUser) {
			// Backoffice: a share session opens the item route of the Content module (FR-084, D-40), so it loads the
			// stores of shared.vue hydrate() (settings, presets, flows and notifications are 403 for a share).
			await useCollectionsStore().hydrate();
			await permissionsStore.hydrate();
			await fieldsStore.hydrate({ skipTranslation: true });
			await useRelationsStore().hydrate();
			await onHydrateModules();
		}

		await setLanguage(userStore.language);

		appStore.basemap = getBasemapSources()[0].name;
	} catch (error: unknown) {
		appStore.error = error;
	} finally {
		appStore.hydrating = false;
	}

	appStore.hydrated = true;
}

export async function dehydrate(stores = useStores()): Promise<void> {
	const appStore = useAppStore();

	if (appStore.hydrated === false) return;

	for (const store of stores) {
		await store.dehydrate?.();
	}

	await onDehydrateModules();

	appStore.hydrated = false;
}
