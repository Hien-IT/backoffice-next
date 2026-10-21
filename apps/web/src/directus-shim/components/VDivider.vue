<!-- Ported from directus/app/src/components/v-divider.vue -->
<script setup lang="ts">
import BoDivider from '../../components/BoDivider.vue';

// Backoffice (spec 020, data-model §7): wraps BoDivider (extended with `large` and the `icon` slot); the default slot
// sits in `.type-text` like Directus, which here inherits the BoDivider title font and color.
withDefaults(
	defineProps<{ vertical?: boolean | undefined; inlineTitle?: boolean | undefined; large?: boolean | undefined }>(),
	{
		vertical: false,
		inlineTitle: true,
		large: false,
	},
);
</script>

<template>
	<BoDivider class="v-divider" :vertical="vertical" :inline-title="inlineTitle" :large="large">
		<template v-if="$slots['icon']" #icon><slot name="icon" /></template>
		<template v-if="$slots['default']" #default>
			<span class="type-text"><slot /></span>
		</template>
	</BoDivider>
</template>

<style scoped>
/* The shim theme's unlayered `.type-text` would beat the BoDivider title utilities. */
.type-text {
	font: inherit;
	color: inherit;
}
</style>
