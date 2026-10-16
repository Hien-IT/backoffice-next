// Ported from directus/packages/themes/src/composables/use-theme.ts
// Backoffice: the themes are the static theme-presets.json (D-89) instead of the @directus/themes store, imported
// only by the lazy system-theme and system-theme-overrides components (research R10); no console warning for an
// unknown theme id (CHK024: the default theme is used, as in Directus). `merge` always starts from a new object (the
// Directus branch without overrides merges into the shared default theme).
import type { DeepPartial, Theme } from '@directus/types';
import { merge } from 'lodash-es';
import type { MaybeRef } from 'vue';
import { computed, unref } from 'vue';
import data from './theme-presets.json';

export const themes = data as unknown as { light: Theme[]; dark: Theme[] };

export const useTheme = (
	darkMode: MaybeRef<boolean>,
	themeLight: MaybeRef<string | null>,
	themeDark: MaybeRef<string | null>,
	themeLightOverrides: MaybeRef<DeepPartial<Theme['rules']>>,
	themeDarkOverrides: MaybeRef<DeepPartial<Theme['rules']>>,
) => {
	const theme = computed<Theme>(() => {
		const themeId = unref(darkMode) ? unref(themeDark) : unref(themeLight);
		const defaultTheme = themes[unref(darkMode) ? 'dark' : 'light'][0]!;
		const overrides = unref(darkMode) ? unref(themeDarkOverrides) : unref(themeLightOverrides);

		const theme = themes[unref(darkMode) ? 'dark' : 'light'].find((theme) => theme.id === themeId);

		return merge({}, defaultTheme, theme, overrides ? { rules: overrides } : {});
	});

	return { theme };
};
