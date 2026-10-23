<!-- Ported from directus/app/src/components/v-text-overflow.vue -->
<script setup lang="ts">
// Backoffice: the full text shows as the native `title` when it is cut (DR: v-tooltip); `highlight` (v-highlight
// for search results) comes with the screens that search (014).
import { useElementSize } from '@vueuse/core';
import { ref, watch } from 'vue';

interface Props {
	/** The text that should be displayed */
	text?: string | number | boolean | Record<string, any> | Array<any> | null | undefined;
}

withDefaults(defineProps<Props>(), {
	text: undefined,
});

const el = ref<HTMLElement>();
const hasEllipsis = ref(false);

const { width } = useElementSize(el);

watch(
	width,
	() => {
		if (!el.value) return;
		hasEllipsis.value = el.value.offsetWidth < el.value.scrollWidth;
	},
	{ immediate: true },
);

function asString(text: Props['text']) {
	return typeof text === 'object' && text !== null ? JSON.stringify(text) : String(text);
}
</script>

<template>
	<div ref="el" class="truncate" :title="hasEllipsis && text !== undefined ? asString(text) : undefined">
		{{ text }}
	</div>
</template>
