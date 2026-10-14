<script setup lang="ts">
// Spinner sized by the surrounding font size (1em) in the surrounding text color: callers set both with classes.
const { value = 0, indeterminate = false } = defineProps<{
	value?: number;
	indeterminate?: boolean;
	ariaLabel?: string;
}>();

const CIRCUMFERENCE = 2 * Math.PI * 10;
</script>

<template>
	<svg
		role="progressbar"
		:aria-label="ariaLabel"
		aria-valuemin="0"
		aria-valuemax="100"
		:aria-valuenow="indeterminate ? undefined : value"
		viewBox="0 0 24 24"
		width="1em"
		height="1em"
		:class="{ 'animate-spin': indeterminate }"
	>
		<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" opacity="0.25" />
		<circle
			cx="12"
			cy="12"
			r="10"
			fill="none"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			transform="rotate(-90 12 12)"
			:stroke-dasharray="CIRCUMFERENCE"
			:stroke-dashoffset="CIRCUMFERENCE * (1 - (indeterminate ? 0.25 : value / 100))"
		/>
	</svg>
</template>
