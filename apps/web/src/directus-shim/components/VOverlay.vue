<!-- Ported from directus/app/src/components/v-overlay.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #41): the DR overlay with the BoDialog overlay colors; `--v-overlay-z-index`
// still sets its layer (default the dialog layer of the z-index scale). The fade is off under reduced motion.
interface Props {
	/** Show / hide the overlay */
	active?: boolean;
	/** Makes the position absolute */
	absolute?: boolean;
	/** Makes the overlay clickable */
	clickable?: boolean;
}

withDefaults(defineProps<Props>(), {
	active: false,
	absolute: false,
	clickable: true,
});

const emit = defineEmits(['click']);

function onClick(event: MouseEvent) {
	emit('click', event);
}
</script>

<template>
	<div
		class="v-overlay inset-0 z-[var(--v-overlay-z-index,99999)] flex items-center justify-center"
		:class="[
			absolute ? 'absolute' : 'fixed',
			active ? 'pointer-events-auto' : 'pointer-events-none',
			{ 'cursor-pointer': clickable },
		]"
		@click="onClick"
	>
		<div
			class="overlay absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none dark:bg-gray-950/60"
			:class="active ? 'opacity-100' : 'opacity-0'"
		/>
		<div v-if="active" class="content relative"><slot /></div>
	</div>
</template>
