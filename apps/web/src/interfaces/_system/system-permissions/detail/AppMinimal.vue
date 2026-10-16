<!-- Ported from directus/app/src/interfaces/_system/system-permissions/detail/components/app-minimal.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-23): a divider line, the warning BoNotice and the read-only values in a `pre`.
import BoNotice from '../../../../components/BoNotice.vue';

defineProps<{
	value?: any;
}>();
</script>

<template>
	<div v-if="value" class="app-minimal mt-6 flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
		<BoNotice type="warning">{{ $t('the_following_are_minimum_permissions') }}</BoNotice>
		<pre
			class="app-minimal-preview m-0 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-theme-xs text-gray-700 dark:bg-white/[0.03] dark:text-gray-400"
			>{{ value }}</pre
		>
	</div>
</template>
