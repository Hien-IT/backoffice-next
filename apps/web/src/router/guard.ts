// Ported from directus/app/src/router.ts (onBeforeEach, onAfterEach)
// Backoffice: the localStorage key has the backoffice- prefix (FR-017, D-39).
import { useLocalStorage } from '@vueuse/core';
import type { NavigationGuard, NavigationHookAfter } from 'vue-router';
import { refresh } from '../auth.ts';
import { hydrate } from '../hydrate.ts';
import { useAppStore } from '../stores/app.ts';
import { useServerStore } from '../stores/server.ts';
import { useUserStore } from '../stores/user.ts';

let firstLoad = true;

/**
 * Reset internal state for testing purposes only.
 * @internal
 */
export function _resetState() {
	firstLoad = true;
}

export const onBeforeEach: NavigationGuard = async (to) => {
	const appStore = useAppStore();
	const serverStore = useServerStore();
	const userStore = useUserStore();
	const requireTfaSetup = useLocalStorage<string | null>('backoffice-require_tfa_setup', null);

	// First load
	if (firstLoad) {
		firstLoad = false;

		// Try retrieving a fresh access token on first load
		try {
			await refresh({ navigate: false });
		} catch {
			// Ignore error
		}
	}

	if (serverStore.info.project === null) {
		try {
			await serverStore.hydrate();
		} catch (error: any) {
			appStore.error = error;
		}
	}

	if (!serverStore.info.setupCompleted) {
		if (to.fullPath === '/setup') return;
		return '/setup';
	}

	if (to.meta?.public !== true) {
		if (appStore.hydrated === false) {
			appStore.hydrating = false;

			if (appStore.authenticated === true) {
				await hydrate();

				if (
					userStore.currentUser &&
					to.fullPath === '/tfa-setup' &&
					!('share' in userStore.currentUser) &&
					userStore.currentUser.tfa_secret !== null
				) {
					return userStore.currentUser.last_page || '/login';
				}

				return to.fullPath;
			} else {
				if (to.fullPath) {
					return '/login?redirect=' + encodeURIComponent(to.fullPath);
				} else {
					return '/login';
				}
			}
		}

		if (userStore.currentUser && !('share' in userStore.currentUser)) {
			if (to.path !== '/tfa-setup') {
				// Check for role-based enforcement
				if (userStore.currentUser.enforce_tfa && userStore.currentUser.tfa_secret === null) {
					if (userStore.currentUser.last_page === to.fullPath) {
						return '/tfa-setup';
					} else {
						return '/tfa-setup?redirect=' + encodeURIComponent(to.fullPath);
					}
				}

				// Check for user-initiated TFA setup request in localStorage
				if (requireTfaSetup.value === userStore.currentUser.id && userStore.currentUser.tfa_secret === null) {
					if (userStore.currentUser.last_page === to.fullPath) {
						return '/tfa-setup';
					} else {
						return '/tfa-setup?redirect=' + encodeURIComponent(to.fullPath);
					}
				}
			} else if (userStore.currentUser.tfa_secret !== null) {
				return userStore.currentUser.last_page || '/login';
			}
		}
	}

	return;
};

let trackTimeout: number | null = null;

export const onAfterEach: NavigationHookAfter = (to) => {
	const userStore = useUserStore();

	if (to.meta.public !== true && to.meta.track !== false) {
		// The timeout gives the page some breathing room to load. No need to clog up the thread with
		// this call while more important things are loading

		if (trackTimeout) {
			window.clearTimeout(trackTimeout);
			trackTimeout = null;
		}

		trackTimeout = window.setTimeout(() => {
			// Backoffice: a failed write (401 once the session is gone, e.g. after deleting yourself) is not an unhandled
			// rejection; DR leaves it unhandled, with the same result for the user.
			userStore.trackPage(to).catch(() => undefined);
		}, 500);
	}
};
