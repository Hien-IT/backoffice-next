<!-- Ported from directus/app/src/displays/rating/rating.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';

type InterfaceOptions = {
	minValue: number;
	maxValue: number;
	stepInterval: number;
};

interface Props {
	// Backoffice: `| undefined` for exactOptionalPropertyTypes (the Directus defaults are undefined).
	value?: string | number | null | undefined;
	simple?: boolean;
	interfaceOptions?: InterfaceOptions | null | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	value: undefined,
	simple: false,
	interfaceOptions: undefined,
});

const starCount = computed(() => {
	if (props.interfaceOptions === null) return 5;

	return Math.ceil(props.interfaceOptions?.maxValue ?? 5);
});

const ratingPercentage = computed(() => ({
	inlineSize: (Number(props.value) / starCount.value) * 100 + '%',
}));

// Backoffice: Rating recipe (component-specs, Tier 3). v-icon `filled` = the Material Symbols FILL axis.
const FILLED = { fontVariationSettings: "'FILL' 1" };
</script>

<template>
	<!-- Backoffice: the warning Badge (light, sm) stands in for the Directus simple badge. -->
	<span
		v-if="simple"
		class="rating simple inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-theme-xs font-semibold text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
	>
		<BoIcon name="star" size="sm" :style="FILLED" />
		{{ value }}
	</span>
	<BoTooltip v-else :text="String(value ?? '')" side="bottom">
		<div class="rating detailed relative inline-flex w-min" role="img" :aria-label="`${value ?? 0} / ${starCount}`">
			<div
				class="active relative z-2 inline-flex overflow-hidden text-warning-600 dark:text-warning-400"
				:style="ratingPercentage"
			>
				<BoIcon v-for="index in starCount" :key="index" name="star" size="sm" class="shrink-0" :style="FILLED" />
			</div>
			<div class="inactive absolute start-0 top-0 z-1 inline-flex text-gray-500">
				<BoIcon v-for="index in starCount" :key="index" name="star" size="sm" class="shrink-0" />
			</div>
		</div>
	</BoTooltip>
</template>
