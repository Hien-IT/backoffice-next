<script setup lang="ts">
// Backoffice (spec 033, FR-046): text of the documentation data (variable and endpoint descriptions) shown as text, with
// the parts in backticks as code. Never HTML: markup in the text stays text.
import { computed } from 'vue';

const { text } = defineProps<{ text: string }>();

const parts = computed(() =>
	text
		.split('`')
		.map((part, index) => ({ code: index % 2 === 1, text: part }))
		.filter((part) => part.text !== ''),
);
</script>

<template>
	<template v-for="(part, i) in parts" :key="i">
		<code v-if="part.code" class="docs-inline-code">{{ part.text }}</code>
		<template v-else>{{ part.text }}</template>
	</template>
</template>
