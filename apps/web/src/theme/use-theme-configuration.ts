// Ported from directus/app/src/composables/use-theme-configuration.ts
// Backoffice: theme names (theme_light, theme_dark, default_theme_*) do not change the Backoffice look (D-43); themeLight
// and themeDark are only read by the system-theme-overrides interface (015, FR-085) to show the Directus rules. The
// overrides are turned into design-system tokens by override-map.ts.
import { merge } from 'lodash-es';
import { computed, ref } from 'vue';
import type { Info } from '../stores/server.ts';
import { useServerStore } from '../stores/server.ts';
import { useUserStore } from '../stores/user.ts';
import type { AppUser } from '../types/user.ts';

export const useThemeConfiguration = () => {
	const serverStore = useServerStore();
	const userStore = useUserStore();

	const browserAppearance = ref<'dark' | 'light'>(
		window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
	);

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ({ matches }) => {
		browserAppearance.value = matches ? 'dark' : 'light';
	});

	const systemSettings = computed(() => {
		let system: Info['project'] | null = null;

		if (serverStore.info?.project) {
			system = serverStore.info.project;
		}

		return system;
	});

	const userSettings = computed(() => {
		let user: AppUser | null = null;

		if (userStore.currentUser && 'appearance' in userStore.currentUser) {
			user = userStore.currentUser;
		}

		return user;
	});

	const configuredAppearance = computed(() => {
		return userSettings.value?.appearance ?? systemSettings.value?.default_appearance ?? 'auto';
	});

	const appearance = computed(() => {
		if (!configuredAppearance.value || configuredAppearance.value === 'auto') {
			return browserAppearance.value;
		}

		return configuredAppearance.value;
	});

	const darkMode = computed(() => appearance.value === 'dark');

	const themeLight = computed(
		() => userSettings.value?.theme_light ?? systemSettings.value?.default_theme_light ?? null,
	);

	const themeDark = computed(() => userSettings.value?.theme_dark ?? systemSettings.value?.default_theme_dark ?? null);

	// The settings are merged last, so they win over the user overrides (owner chose the Directus order 2026-10-14).
	const themeLightOverrides = computed(() =>
		merge({}, userSettings.value?.theme_light_overrides, systemSettings.value?.theme_light_overrides),
	);

	const themeDarkOverrides = computed(() =>
		merge({}, userSettings.value?.theme_dark_overrides, systemSettings.value?.theme_dark_overrides),
	);

	return { darkMode, themeLight, themeDark, themeLightOverrides, themeDarkOverrides };
};
