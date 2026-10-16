<!-- Ported from directus/app/src/interfaces/_system/system-permissions/permissions-header.vue -->
<script setup lang="ts">
// Backoffice: header cells with `scope="col"` in the Q-2 table header look.
const TH =
	'border-b border-gray-200 bg-gray-50 px-3 py-3 text-start text-theme-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400';
</script>

<template>
	<thead class="permissions-overview-header">
		<tr>
			<th scope="col" :class="TH">{{ $t('collection') }}</th>
			<th scope="colgroup" colspan="6" :class="TH">{{ $t('actions') }}</th>
		</tr>
	</thead>
</template>
