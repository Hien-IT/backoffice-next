<!-- Ported from directus/app/src/displays/datetime/datetime.vue -->
<script setup lang="ts">
// Backoffice: the logic of directus/app/src/components/use-datetime.vue (its renderless slot) is inlined here.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import BoTooltip from '../../components/BoTooltip.vue';
import { formatDate, type FormatDateOptions, formatTimezoneLabel } from '../../utils/format-date.ts';

interface Props extends FormatDateOptions {
	value: string;
}

const props = withDefaults(defineProps<Props>(), {
	format: 'long',
	relative: false,
	strict: false,
	round: 'round',
	suffix: true,
	use24: false,
});

const tzTooltip = computed(() => {
	if (!props.tz || !props.value) return undefined;
	return formatTimezoneLabel(props.tz, props.value);
});

// use-datetime.vue
const displayValue = ref<string | null>(null);

watch(
	() => props.value,
	(newValue) => {
		// Backoffice: cast for exactOptionalPropertyTypes (props carry `undefined` for missing options).
		displayValue.value = formatDate(newValue, props as FormatDateOptions);
	},
	{ immediate: true },
);

let refreshInterval: number | null = null;

onMounted(() => {
	if (!props.relative) return;

	refreshInterval = window.setInterval(() => {
		displayValue.value = formatDate(props.value, props as FormatDateOptions);
	}, 60_000);
});

onUnmounted(() => {
	if (refreshInterval) clearInterval(refreshInterval);
});

const CLASS = 'datetime overflow-hidden leading-[1.15] text-ellipsis whitespace-nowrap';
</script>

<template>
	<BoTooltip v-if="tzTooltip" :text="tzTooltip" side="bottom">
		<span :class="CLASS">{{ displayValue }}</span>
	</BoTooltip>
	<span v-else :class="CLASS">{{ displayValue }}</span>
</template>
