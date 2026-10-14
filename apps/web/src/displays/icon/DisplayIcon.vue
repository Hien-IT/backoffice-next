<!-- Ported from directus/app/src/displays/icon/icon.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';

const props = defineProps<{
	value: string | null;
	color?: string;
	filled?: boolean;
}>();

// Backoffice: directus/app/src/utils/is-hex.ts inlined (its only user here).
const isHex = (hex: string) => /^#(([a-f\d]{3,4}))$/i.test(hex) || /^#(([a-f\d]{2}){3,4})$/i.test(hex);

// Backoffice: BoIcon takes the text color (`--v-icon-color`) and the Material Symbols FILL axis (v-icon `filled`).
const style = computed(() => ({
	...(props.color && isHex(props.color) ? { color: props.color } : {}),
	...(props.filled ? { fontVariationSettings: "'FILL' 1" } : {}),
}));
</script>

<template>
	<!-- v-icon renders nothing without a name. -->
	<BoIcon v-if="value" :name="value" size="sm" :style="style" />
</template>
