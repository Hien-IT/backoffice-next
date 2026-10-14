<!-- Ported from directus/app/src/views/private/components/value-null.vue -->
<script setup lang="ts">
// Backoffice: ValueNull recipe; "--" is hidden from screen readers, which read `no_value` instead.
</script>

<template>
	<span class="text-gray-500 dark:text-gray-400">
		<span aria-hidden="true">--</span>
		<span class="sr-only">{{ $t('no_value') }}</span>
	</span>
</template>
