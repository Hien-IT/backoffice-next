<!-- Ported from directus/app/src/modules/content/components/navigation-item-content.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §9. The color is data (Q-C of 013), set as an inline style; without one the icon
// takes the row color (Directus: var(--theme--foreground)), which keeps the active row contrast (axe color-contrast). `hidden` adds the visibility_off marker of hidden
// collections. The search highlight of v-text-overflow is not ported (BoTextOverflow has no `highlight`).
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';

defineProps<{
	name: string;
	/** No icon for a root folder shown as a group title (D-156). */
	icon?: string | undefined;
	color?: string | null | undefined;
	hidden?: boolean | undefined;
}>();
</script>

<template>
	<BoIcon v-if="icon" :name="icon" size="sm" class="shrink-0" :style="color ? { color } : undefined" />
	<BoTextOverflow :text="name" class="min-w-0 flex-1" />
	<template v-if="hidden">
		<BoIcon name="visibility_off" size="sm" class="shrink-0" />
		<span class="sr-only">({{ $t('hidden') }})</span>
	</template>
</template>
