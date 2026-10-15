<!-- Ported from directus/app/src/layouts/tabular/actions.vue -->
<script setup lang="ts">
// Backoffice: the count line is a `role="status"` `aria-live="polite"` region that stays in the DOM (FR-115b), so the
// page change (new count line) and the sort change (screen reader text) are announced; no fade transition (the region
// must not be removed); below `sm` it is screen reader only instead of `display: none`.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { HeaderRaw } from './types.ts';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
	showingCount?: string | undefined;
	tableSort?: { by: string; desc: boolean } | null | undefined;
	tableHeaders?: HeaderRaw[] | undefined;
}>();

const { t } = useI18n();

const sortText = computed(() => {
	if (!props.tableSort?.by) return '';
	const field = props.tableHeaders?.find((header) => header.value === props.tableSort!.by)?.text ?? props.tableSort.by;
	return t(props.tableSort.desc ? 'table_sorted_desc' : 'table_sorted_asc', { field });
});
</script>

<template>
	<span
		role="status"
		aria-live="polite"
		class="sr-only whitespace-nowrap text-theme-sm text-gray-500 sm:not-sr-only dark:text-gray-400"
	>
		<template v-if="showingCount">{{ showingCount }}</template>
		<span class="sr-only">{{ sortText }}</span>
	</span>
</template>
