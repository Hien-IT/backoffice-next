<!-- Ported from directus/app/src/interfaces/presentation-divider/presentation-divider.vue -->
<script setup lang="ts">
// Backoffice: v-divider is BoDivider (Tier 3 Divider recipe); `title` comes translated from the fields store
// (`$t:` options). `large` has no counterpart in the recipe.
import { inject } from 'vue';
import BoDivider from '../../components/BoDivider.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

defineProps<{
	color?: string;
	icon?: string;
	title?: string;
	inlineTitle?: boolean;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
</script>

<template>
	<BoDivider
		:id="a11y?.inputId"
		:aria-describedby="a11y?.describedBy"
		:class="{ 'mt-9': icon || title }"
		:color
		:icon
		:title
		:inline-title="inlineTitle"
	/>
</template>
