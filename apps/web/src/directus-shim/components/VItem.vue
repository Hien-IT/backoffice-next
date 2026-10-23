<!-- Ported from directus/app/src/components/v-item.vue -->
<script setup lang="ts">
import { useGroupable } from '@directus/composables';
import { toRefs, type Ref } from 'vue';

// Backoffice (spec 020, data-model §7): same groupable item as DR; the slot gets `{ active, toggle }`.
const props = withDefaults(
	defineProps<{
		value?: string | number | undefined;
		scope?: string | undefined;
		active?: boolean | undefined;
		watch?: boolean | undefined;
	}>(),
	{
		value: undefined,
		scope: 'item-group',
		active: undefined,
		watch: true,
	},
);

const { active } = toRefs(props);

const { active: isActive, toggle } = useGroupable({
	...(props.value === undefined ? {} : { value: props.value }),
	group: props.scope,
	watch: props.watch,
	active: active as Ref<boolean>,
});
</script>

<template>
	<div class="v-item">
		<slot v-bind="{ active: isActive, toggle }" />
	</div>
</template>
