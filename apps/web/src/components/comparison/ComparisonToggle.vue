<!-- Ported from directus/app/src/views/private/components/comparison/comparison-toggle.vue -->
<script setup lang="ts">
// Backoffice: BoMenu with a chip-like trigger (Directus: v-menu with v-chip); "previous" is the solid brand chip,
// "latest" the light one, as the Directus colors.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../BoIcon.vue';
import BoMenu from '../BoMenu.vue';

const props = withDefaults(
	defineProps<{
		modelValue?: 'Previous' | 'Latest';
		disablePrevious?: boolean;
	}>(),
	{
		modelValue: 'Previous',
		disablePrevious: false,
	},
);

const emit = defineEmits<{
	'update:modelValue': [value: 'Previous' | 'Latest'];
}>();

const { t } = useI18n();

function selectOption(option: 'Previous' | 'Latest') {
	if (option === 'Previous' && props.disablePrevious) return;
	emit('update:modelValue', option);
}

const displayValue = computed(() => {
	return props.modelValue === 'Previous' ? t('previous') : t('latest');
});

const items = computed(() => [
	{ text: t('latest_revision'), icon: 'check_circle', onSelect: () => selectOption('Latest') },
	{
		text: t('previous_revision'),
		icon: 'history',
		disabled: props.disablePrevious,
		onSelect: () => selectOption('Previous'),
	},
]);
</script>

<template>
	<BoMenu :items side="top">
		<template #trigger>
			<button
				type="button"
				data-comparison-toggle
				class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
				:class="
					modelValue === 'Previous'
						? 'bg-brand-500 text-white hover:bg-brand-600'
						: 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400'
				"
			>
				{{ displayValue }}
				<BoIcon name="sync_alt" size="sm" />
			</button>
		</template>
	</BoMenu>
</template>
