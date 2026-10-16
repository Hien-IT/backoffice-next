<!-- Ported from directus/app/src/interfaces/_system/system-theme/system-theme.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-19 "Theme picker": a Reka RadioGroup of cards (the buttons with radio icons of Directus), each
// with the Directus theme preview. The themes are the static Directus theme data (D-89); labels go through the
// theme_directus_* keys, which the overlay turns into "Backoffice Default"... while the stored ids stay "Directus
// Default"... (D-88). Choosing a theme does not change the Backoffice look, the note under the list says so (D-88).
// A null value without `includeNull` selects the first theme by id (FR-084; Directus compares with its `name`, so no
// card is active there). An unknown id leaves every card unchecked and the value as it is (CHK024). `disabled` is
// applied (Directus ignores it).
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import { computed, inject, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useServerStore } from '../../../stores/server.ts';
import { themes } from '../../../theme/use-directus-theme.ts';
import ThemePreview from './ThemePreview.vue';

const emit = defineEmits<{
	input: [string | null];
}>();

const props = defineProps<{
	appearance: 'dark' | 'light';
	value: string | null;
	disabled: boolean;
	includeNull?: boolean;
}>();

const { t } = useI18n();
const serverStore = useServerStore();
const a11y = inject(FORM_FIELD_A11Y, null);
const hintId = useId();

// Reka radio values cannot be null.
const NULL_VALUE = '$null';

// directus/app/src/utils/translate-literal.ts
const translate = (literal: string) => (literal.startsWith('$t:') ? t(literal.slice(3)) : literal);

const systemTheme = computed(() => {
	const theme =
		props.appearance === 'dark'
			? serverStore.info.project?.default_theme_dark
			: serverStore.info.project?.default_theme_light;

	return theme ?? null;
});

const items = computed(() => themes[props.appearance].map((theme) => ({ id: theme.id, name: theme.name })));

const valueWithDefault = computed(() => {
	if (props.includeNull) {
		return props.value ?? NULL_VALUE;
	}

	return props.value ?? themes[props.appearance][0]?.id ?? null;
});

const CARD =
	'group flex flex-col gap-2 rounded-xl border bg-white p-2 text-start text-sm font-medium text-gray-700 shadow-theme-xs hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-brand-500 data-[state=checked]:ring-2 data-[state=checked]:ring-brand-500/20 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400 dark:data-[state=checked]:border-brand-400 border-gray-200 dark:border-gray-800';
</script>

<template>
	<div>
		<RadioGroupRoot
			:id="a11y?.inputId"
			:model-value="valueWithDefault"
			:disabled="disabled"
			:aria-labelledby="a11y?.labelId"
			:aria-describedby="[a11y?.describedBy, hintId].filter(Boolean).join(' ')"
			class="grid grid-cols-2 gap-4 sm:grid-cols-3"
			@update:model-value="emit('input', $event === NULL_VALUE ? null : ($event as string))"
		>
			<RadioGroupItem v-if="includeNull" v-slot="{ checked }" :value="NULL_VALUE" :class="CARD">
				<ThemePreview :dark-mode="appearance === 'dark'" :theme="systemTheme" />
				<span class="flex min-w-0 items-center gap-1">
					<BoIcon
						:name="checked ? 'radio_button_checked' : 'radio_button_unchecked'"
						size="sm"
						class="shrink-0 text-brand-500 dark:text-brand-400"
					/>
					<BoTextOverflow :text="$t('default_sync_with_project')" />
				</span>
			</RadioGroupItem>

			<RadioGroupItem v-for="theme of items" :key="theme.id" v-slot="{ checked }" :value="theme.id" :class="CARD">
				<ThemePreview :dark-mode="appearance === 'dark'" :theme="theme.id" />
				<span class="flex min-w-0 items-center gap-1">
					<BoIcon
						:name="checked ? 'radio_button_checked' : 'radio_button_unchecked'"
						size="sm"
						class="shrink-0 text-brand-500 dark:text-brand-400"
					/>
					<BoTextOverflow :text="translate(theme.name)" />
				</span>
			</RadioGroupItem>
		</RadioGroupRoot>

		<p :id="hintId" class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
			{{ $t('theme_applies_in_directus') }}
		</p>
	</div>
</template>
