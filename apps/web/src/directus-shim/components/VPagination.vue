<!-- Ported from directus/app/src/components/v-pagination.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-pagination on BoPagination with the Directus defaults: no page buttons without
// `totalVisible` (0 for BoPagination, whose default is 7), no first/last unless asked, shown with one page too. The nav
// gets the `pagination` label (Directus has no accessible name here).
import BoPagination from '../../components/BoPagination.vue';

defineProps<{
	/** Currently selected page */
	modelValue: number;
	/** The amount of pages to render */
	length: number;
	/** Disables the pagination */
	disabled?: boolean;
	/** Specify the max total visible pagination numbers */
	totalVisible?: number;
	/** Show first/last buttons */
	showFirstLast?: boolean;
}>();

defineEmits(['update:modelValue']);
</script>

<template>
	<BoPagination
		:model-value="modelValue"
		:length="length"
		:disabled="!!disabled"
		:total-visible="totalVisible ?? 0"
		:show-first-last="!!showFirstLast"
		:label="$t('pagination')"
		always-show
		@update:model-value="$emit('update:modelValue', $event)"
	/>
</template>
