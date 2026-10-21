<!-- Ported from directus/app/src/components/transition/bounce.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #65): the Directus menu transition (fade, a `.v-menu-content` child grows from
// its `data-placement` side); off under reduced motion. Not scoped on purpose: the children are teleported.
</script>

<template>
	<TransitionGroup name="bounce" tag="div" v-bind="$attrs">
		<slot />
	</TransitionGroup>
</template>

<style>
.bounce-enter-active,
.bounce-leave-active {
	transition: opacity var(--fast, 125ms) var(--transition, ease);
}

.bounce-enter-active > .v-menu-content,
.bounce-leave-active > .v-menu-content {
	transition: transform var(--fast, 125ms) cubic-bezier(0, 0, 0.2, 1.5);
}

.bounce-enter-from,
.bounce-leave-to {
	opacity: 0;
}

:is(.bounce-enter-from, .bounce-leave-to):is([data-placement='top'], [data-placement^='bottom']) > .v-menu-content {
	transform: scaleY(0.8);
}

:is(.bounce-enter-from, .bounce-leave-to):is([data-placement='right'], [data-placement='left']) > .v-menu-content {
	transform: scaleX(0.8);
}

:is(.bounce-enter-from, .bounce-leave-to):is(
		[data-placement^='top-'],
		[data-placement^='right-'],
		[data-placement^='left-']
	)
	> .v-menu-content {
	transform: scaleY(0.8) scaleX(0.8);
}

@media (prefers-reduced-motion: reduce) {
	.bounce-enter-active,
	.bounce-leave-active,
	.bounce-enter-active > .v-menu-content,
	.bounce-leave-active > .v-menu-content {
		transition: none;
	}
}
</style>
