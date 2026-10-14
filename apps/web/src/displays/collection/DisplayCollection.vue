<!-- Ported from directus/app/src/displays/collection/collection.vue -->
<script setup lang="ts">
import { toRefs } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import ValueNull from '../../components/render/ValueNull.vue';
import { useCollection } from '../../composables/use-collection.ts';

const props = withDefaults(
	defineProps<{
		value?: string | null;
		icon?: boolean;
	}>(),
	{
		value: null,
		icon: false,
	},
);

const collection = toRefs(props).value;
const { info } = useCollection(collection);
</script>

<template>
	<ValueNull v-if="value === null || !info" />
	<div v-else class="inline-flex items-center gap-1">
		<BoIcon v-if="icon" :name="info.icon" size="sm" />
		{{ info.name }}
	</div>
</template>
