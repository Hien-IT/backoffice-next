<!-- Ported from directus/app/src/components/transition/dialog.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #66): the Directus dialog transition (fade, the content slides in from the
// `center`/`left`/`right` side of its container); off under reduced motion. Not scoped on purpose: the children are
// teleported.
</script>

<template>
	<Transition name="dialog">
		<slot />
	</Transition>
</template>

<style>
.dialog-enter-active,
.dialog-leave-active {
	transition: opacity var(--medium, 200ms) var(--transition, ease);
}

.dialog-enter-active > *:not(.v-overlay),
.dialog-leave-active > *:not(.v-overlay) {
	translate: 0;
	transition: translate var(--medium, 200ms) var(--transition-in, ease-out);
}

.dialog-enter-from,
.dialog-leave-to {
	opacity: 0;
}

.dialog-enter-from.center > *:not(.v-overlay),
.dialog-leave-to.center > *:not(.v-overlay) {
	translate: 0 2.8125rem;
}

.dialog-enter-from.left > *:not(.v-overlay),
.dialog-leave-to.left > *:not(.v-overlay),
.dialog-enter-from.right:dir(rtl) > *:not(.v-overlay),
.dialog-leave-to.right:dir(rtl) > *:not(.v-overlay) {
	translate: -2.8125rem 0;
}

.dialog-enter-from.right > *:not(.v-overlay),
.dialog-leave-to.right > *:not(.v-overlay),
.dialog-enter-from.left:dir(rtl) > *:not(.v-overlay),
.dialog-leave-to.left:dir(rtl) > *:not(.v-overlay) {
	translate: 2.8125rem 0;
}

@media (prefers-reduced-motion: reduce) {
	.dialog-enter-active,
	.dialog-leave-active,
	.dialog-enter-active > *,
	.dialog-leave-active > * {
		transition: none;
	}
}
</style>
