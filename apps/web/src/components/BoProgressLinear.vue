<script setup lang="ts">
const { value = 0, indeterminate = false } = defineProps<{
	value?: number;
	indeterminate?: boolean;
	ariaLabel?: string;
}>();
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
			class="h-full bg-brand-500 dark:bg-brand-400"
			:class="{ 'bo-progress-linear-indeterminate': indeterminate }"
			:style="indeterminate ? undefined : { width: `${value}%` }"
		/>
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
