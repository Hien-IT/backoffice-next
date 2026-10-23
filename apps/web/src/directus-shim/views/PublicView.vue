<!-- Ported from directus/app/src/views/public/public-view.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7, Q-45): the DR public view of extensions on the public layout of 012
// (layout/PublicView.vue); `wide` widens the form column to 40 rem.
import LayoutPublicView from '../../layout/PublicView.vue';

withDefaults(defineProps<{ wide?: boolean }>(), { wide: false });
</script>

<template>
	<LayoutPublicView :wide="wide">
		<slot />
		<template #notice><slot name="notice" /></template>
	</LayoutPublicView>
</template>
