<script setup lang="ts">
import { computed } from 'vue';

const {
	value = 0,
	indeterminate = false,
	colorful = false,
} = defineProps<{
	value?: number;
	indeterminate?: boolean;
	ariaLabel?: string;
	/** The bar is error up to 33 %, warning up to 66 %, then success (v-progress-linear `colorful`, spec 020). */
	colorful?: boolean;
}>();

const bar = computed(() => {
	if (!colorful) return 'bg-brand-500 dark:bg-brand-400';
	if (value <= 33) return 'bg-error-500';
	if (value <= 66) return 'bg-warning-500';
	return 'bg-success-500';
});
</script>

<template>
	<div
		role="progressbar"
		:aria-label="ariaLabel"
		aria-valuemin="0"
		aria-valuemax="100"
		:aria-valuenow="indeterminate ? undefined : value"
		class="relative h-1 w-full overflow-hidden bg-gray-100 dark:bg-white/5"
	>
		<div
			class="h-full"
			:class="[bar, { 'bo-progress-linear-indeterminate': indeterminate }]"
			:style="indeterminate ? undefined : { width: `${value}%` }"
		/>
		<span v-if="$slots['default']" class="absolute inset-0 flex items-center justify-center">
			<slot :value="value" />
		</span>
	</div>
</template>

<style scoped>
.bo-progress-linear-indeterminate {
	position: absolute;
	width: 40%;
	animation: bo-progress-linear 1.2s ease-in-out infinite;
}

@keyframes bo-progress-linear {
	from {
		left: -40%;
	}

	to {
		left: 100%;
	}
}
</style>
