<!-- Ported from directus/app/src/displays/hash/hash.vue -->
<script setup lang="ts">
import ValueNull from '../../components/render/ValueNull.vue';

withDefaults(
	defineProps<{
		value?: string | null;
	}>(),
	{
		value: null,
	},
);
</script>

<template>
	<ValueNull v-if="value === null" />

	<div v-else>**********</div>
</template>
