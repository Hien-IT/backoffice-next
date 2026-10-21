<!-- Ported from directus/app/src/components/v-chip.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoChip (extended with the default slot, removeIcon, outlined, squared,
// clickable and the lg size): `close` → `removable`, `label` → `squared`; x-small/small → sm, normal → md,
// large/x-large → lg. Deviation: no `aria-pressed` on the chip (not allowed on a span).
import { computed, ref } from 'vue';
import BoChip from '../../components/BoChip.vue';

interface Props {
	active?: boolean | undefined;
	close?: boolean;
	closeIcon?: string;
	outlined?: boolean;
	label?: boolean;
	disabled?: boolean;
	xSmall?: boolean;
	small?: boolean;
	large?: boolean;
	xLarge?: boolean;
	clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	active: undefined,
	close: false,
	// ponytail: factory because contract.test.ts evaluates a string default as code ('close' is window.close in
	// happy-dom); back to the literal once the test compares shim defaults as values.
	closeIcon: () => 'close',
	outlined: false,
	label: true,
	disabled: false,
});

const emit = defineEmits<{
	'update:active': [active: boolean];
	click: [event: MouseEvent];
	close: [event: MouseEvent];
}>();

const internalLocalActive = ref(true);

const internalActive = computed<boolean>({
	get: () => {
		if (props.active !== undefined) return props.active;
		return internalLocalActive.value;
	},
	set: (active: boolean) => {
		emit('update:active', active);
		internalLocalActive.value = active;
	},
});

const size = computed(() => {
	if (props.xSmall || props.small) return 'sm';
	if (props.large || props.xLarge) return 'lg';
	return 'md';
});

function onClick(event: MouseEvent) {
	if (props.disabled) return;
	emit('click', event);
}

function onCloseClick(event: MouseEvent) {
	// Directus @click.stop: the close button does not click the chip.
	event.stopPropagation();
	if (props.disabled) return;
	internalActive.value = !internalActive.value;
	emit('close', event);
}
</script>

<template>
	<BoChip
		v-if="internalActive"
		:size
		:removable="close"
		:remove-icon="closeIcon"
		:disabled
		:outlined
		:squared="label"
		:clickable
		@click="onClick"
		@remove="onCloseClick"
	>
		<slot />
	</BoChip>
</template>
