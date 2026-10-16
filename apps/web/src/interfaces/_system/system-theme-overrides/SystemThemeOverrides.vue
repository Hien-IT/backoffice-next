<!-- Ported from directus/app/src/interfaces/_system/system-theme-overrides/system-theme-overrides.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-19 "Theme overrides". The rule tree is the Directus theme of the signed-in user (static data,
// theme/use-theme-preset.ts, D-89); keys and values are written as in Directus, only the keys mapped in
// theme/override-map.ts change the Backoffice look (D-43). A stored value that is not an object shows an empty block and
// is kept as it is (CHK082). Clearing a rule works on a deep clone (Directus unsets on a shallow clone, which also
// changes the nested objects of the current value).
import type { DeepPartial, Theme } from '@directus/types';
import { clone, cloneDeep, get, isEmpty, isPlainObject, setWith, unset } from 'lodash-es';
import { computed } from 'vue';
import { useTheme } from '../../../theme/use-theme-preset.ts';
import { useThemeConfiguration } from '../../../theme/use-theme-configuration.ts';
import SystemThemeOverridesGroup from './SystemThemeOverridesGroup.vue';
import type { SetValueFn } from './types.ts';

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<{
	value: Record<string, unknown> | null;
	appearance: 'dark' | 'light';
}>();

const emit = defineEmits<{
	input: [DeepPartial<Theme> | null];
}>();

const set: SetValueFn = (path: string[], value: string) => {
	if (value.length === 0) {
		const clonedVal = cloneDeep(props.value ?? {});

		unset(clonedVal, path);

		/**
		 * loop backwards over the path, making sure to unset empty objects as we go up the tree to
		 * cleanup the stored value
		 */
		while (--path.length && isEmpty(get(clonedVal, path))) {
			unset(clonedVal, path);
		}

		emit('input', clonedVal);
	} else {
		emit('input', setWith(clone(props.value ?? {}), path, value, clone));
	}
};

const { themeDark, themeLight } = useThemeConfiguration();

const darkMode = computed(() => props.appearance === 'dark');

const { theme } = useTheme(darkMode, themeLight, themeDark, {}, {});

const validValue = computed(() => props.value === null || props.value === undefined || isPlainObject(props.value));
</script>

<template>
	<div
		class="max-h-80 overflow-y-auto rounded-lg border border-gray-500 bg-transparent px-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:focus-within:border-brand-400"
		lang="en-US"
		dir="ltr"
		data-theme-overrides
	>
		<SystemThemeOverridesGroup v-if="validValue" root :rules="theme.rules" :path="[]" :value="value ?? {}" :set="set" />
	</div>
</template>
