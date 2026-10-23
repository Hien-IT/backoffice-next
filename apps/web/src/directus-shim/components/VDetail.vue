<!-- Ported from directus/app/src/components/v-detail.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import BoDetail from '../../components/BoDetail.vue';

// Backoffice (spec 020, data-model §7): wraps BoDetail (extended with the `activator` slot). `label` → `title`
// (default `$t('toggle')`); without `modelValue` the state is local and starts from `startOpen`, as in DR.
const props = withDefaults(
	defineProps<{
		modelValue?: boolean | undefined;
		label?: string | undefined;
		startOpen?: boolean | undefined;
		disabled?: boolean | undefined;
	}>(),
	{
		modelValue: undefined,
		label: undefined,
		startOpen: false,
		disabled: false,
	},
);

const emit = defineEmits(['update:modelValue']);

const localActive = ref(props.startOpen);

const internalActive = computed({
	get: () => (props.modelValue !== undefined ? props.modelValue : localActive.value),
	set(newActive: boolean) {
		localActive.value = newActive;
		emit('update:modelValue', newActive);
	},
});
</script>

<template>
	<BoDetail v-model="internalActive" class="v-detail" :title="label || $t('toggle')" :disabled="disabled">
		<template v-if="$slots['activator']" #activator="scope"><slot name="activator" v-bind="scope" /></template>
		<template v-if="$slots['title']" #title><slot name="title" /></template>
		<slot />
	</BoDetail>
</template>
