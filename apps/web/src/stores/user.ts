// Ported from directus/app/src/stores/user.ts
import { merge } from 'lodash-es';
import { defineStore } from 'pinia';
import { computed, ref, unref, watch } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { RTL_LANGUAGES } from '../constants.ts';
import { i18n } from '../lang/index.ts';
import { setLanguage } from '../lang/set-language.ts';
import type { AppUser, ShareUser } from '../types/user.ts';
import { userName } from '../utils/user-name.ts';
import { useServerStore } from './server.ts';

export const useUserStore = defineStore('userStore', () => {
	const serverStore = useServerStore();

	const currentUser = ref<AppUser | ShareUser | null>(null);
	const loading = ref(false);
	const error = ref<unknown>(null);

	const fullName = computed(() => {
		const user = unref(currentUser);
		if (user === null || 'share' in user) return null;
		return userName(user);
	});

	const isAdmin = computed(() => unref(currentUser)?.admin_access === true || false);

	const language = computed(() => {
		const user = unref(currentUser);

		if (user && 'language' in user && user.language !== null) {
			return user.language;
		}

		if (serverStore.info?.project?.default_language) {
			return serverStore.info.project.default_language;
		}

		return 'en-US';
	});

	watch(language, (newLang, oldLang) => {
		if (newLang && newLang !== oldLang) {
			setLanguage(newLang);
		}
	});

	const textDirection = computed(() => {
		const user = unref(currentUser);
		// Backoffice: the direction follows the language actually loaded (en-US or vi-VN, D-46), not the requested one.
		const lang = unref(i18n.global.locale);

		const savedDir = (user && 'text_direction' in user && user.text_direction) || 'auto';

		let dir: 'ltr' | 'rtl';

		if (savedDir === 'ltr' || savedDir === 'rtl') {
			dir = savedDir;
		} else {
			dir = (RTL_LANGUAGES as readonly string[]).includes(lang) ? 'rtl' : 'ltr';
		}

		return dir;
	});

	const hydrate = async () => {
		loading.value = true;

		try {
			const fields = ['*', 'role.id'];

			const [user, globals, roles] = await Promise.all([
				sdk.request(requestEndpoint<Record<string, any>>('/users/me', { method: 'GET', params: { fields } })),
				sdk.request(requestEndpoint<Record<string, any>>('/policies/me/globals', { method: 'GET' })),
				sdk.request(requestEndpoint<{ id: string }[]>('/roles/me', { method: 'GET', params: { fields: ['id'] } })),
			]);

			currentUser.value = {
				...user,
				...(user?.['avatar'] != null ? { avatar: { id: user['avatar'] } } : {}),
				...globals,
				roles,
			} as AppUser | ShareUser;
		} catch (err: unknown) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	};

	const dehydrate = async () => {
		currentUser.value = null;
		loading.value = false;
		error.value = null;
	};

	const hydrateAdditionalFields = async (fields: string[]) => {
		try {
			const data = await sdk.request(requestEndpoint('/users/me', { method: 'GET', params: { fields } }));

			currentUser.value = merge({}, unref(currentUser), data);
		} catch {
			// Do nothing
		}
	};

	const trackPage = async (to: RouteLocationNormalized) => {
		/**
		 * We don't want to track the full screen preview from live previews as part of the user's
		 * last page, as that'll cause a fresh login to navigate to the full screen preview where
		 * you can't navigate away from #19160 (raw-color-allowed: Directus issue number)
		 */
		if (to.path.endsWith('/preview')) {
			return;
		}

		const user = unref(currentUser);

		// Backoffice: share users have no last_page (FR-018).
		if (!user || 'share' in user) return;

		await sdk.request(requestEndpoint('/users/me/track/page', { method: 'PATCH', body: { last_page: to.fullPath } }));

		user.last_page = to.fullPath;
	};

	return {
		currentUser,
		loading,
		error,
		fullName,
		isAdmin,
		language,
		textDirection,
		hydrate,
		dehydrate,
		hydrateAdditionalFields,
		trackPage,
	};
});
