// Ported from directus/packages/stores/src/app.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Global application state
 */
export const useAppStore = defineStore('appStore', () => {
	/** Have all stores been hydrated. This indicates that the app is ready to be rendered */
	const hydrated = ref(false);

	/** Stores are currently being hydrated */
	const hydrating = ref(false);

	/** Global hydration error. App should not be rendered */
	const error = ref<unknown>(null);

	/** Is the current user authenticated. @TODO maybe move to userStore */
	const authenticated = ref(false);

	/** How long until the access token will expire */
	const accessTokenExpiry = ref(0);

	// Backoffice: layout state of the private view (data-model §1); notificationsDrawerOpen and basemap belong to
	// later features (D-45).
	const navbarOpen = ref(false);
	const sidebarOpen = ref(false);
	const fullScreen = ref(false);

	return {
		hydrated,
		hydrating,
		error,
		authenticated,
		accessTokenExpiry,
		navbarOpen,
		sidebarOpen,
		fullScreen,
	};
});
