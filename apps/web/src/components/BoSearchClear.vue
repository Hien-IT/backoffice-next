<script setup lang="ts">
// Owner 2026-10-23 (D-169): the X button of every search field (BoInput type="search" and the search inputs of the
// select dropdown, icon picker and checkbox tree; SearchInput has its own). The parent shows it when the field has
// text, sits it at the end of a `relative` box around the input and clears the text and focuses the input again on
// click. Directus search fields have none (its native one is hidden by base.css, as Directus _base.scss). mousedown
// keeps the focus in the input, so a popover or select around it stays open.
import BoIcon from './BoIcon.vue';

defineEmits<{ click: [] }>();
</script>

<template>
	<button
		type="button"
		class="absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
		:aria-label="$t('clear_value')"
		:title="$t('clear_value')"
		@mousedown.prevent
		@click="$emit('click')"
	>
		<BoIcon name="close" size="sm" />
	</button>
</template>
