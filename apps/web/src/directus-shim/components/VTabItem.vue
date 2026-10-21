<!-- Ported from directus/app/src/components/v-tab-item.vue -->
<script setup lang="ts">
import { useGroupable } from '@directus/composables';

// Backoffice (spec 020, data-model §7): joins the `v-tabs-items` group like Directus; rendered only while active.
const props = withDefaults(defineProps<{ value?: string | number | undefined }>(), { value: undefined });

const { active, toggle } = useGroupable({
	...(props.value === undefined ? {} : { value: props.value }),
	group: 'v-tabs-items',
});
</script>

<template>
	<div v-if="active" class="v-tab-item">
		<slot v-bind="{ active, toggle }" />
	</div>
</template>
