<!-- Ported from directus/app/src/layouts/tabular/options.vue -->
<script setup lang="ts">
// Backoffice: BoSelect with its label instead of `.type-label` + v-select; `useSync` = emit of the update.
import BoSelect from '../../components/BoSelect.vue';

defineOptions({ inheritAttrs: false });

defineProps<{
	tableSpacing: 'compact' | 'cozy' | 'comfortable';
}>();

const emit = defineEmits<{ 'update:tableSpacing': [value: 'compact' | 'cozy' | 'comfortable'] }>();
</script>

<template>
	<BoSelect
		:label="$t('layouts.tabular.spacing')"
		:model-value="tableSpacing"
		:items="[
			{ text: $t('layouts.tabular.compact'), value: 'compact' },
			{ text: $t('layouts.tabular.cozy'), value: 'cozy' },
			{ text: $t('layouts.tabular.comfortable'), value: 'comfortable' },
		]"
		@update:model-value="emit('update:tableSpacing', $event as 'compact' | 'cozy' | 'comfortable')"
	/>
</template>
