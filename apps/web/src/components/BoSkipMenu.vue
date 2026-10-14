<script setup lang="ts">
// Idea from directus/app/src/views/private/components/skip-menu.vue: links hidden until one of them gets keyboard
// focus. The targets (#main-content, #navigation) need tabindex="-1" so focus moves there.
const LINKS = [
	{ hash: '#main-content', key: 'skip_to_content' },
	{ hash: '#navigation', key: 'skip_to_navigation' },
];
</script>

<template>
	<div class="bo-skip-menu">
		<a
			v-for="link in LINKS"
			:key="link.hash"
			:href="link.hash"
			class="block rounded-eh-sm px-eh-3 py-eh-2 text-eh-sm text-eh-text-primary hover:bg-eh-surface-subtle"
		>
			{{ $t(link.key) }}
		</a>
	</div>
</template>

<style scoped>
.bo-skip-menu:not(:focus-within) {
	position: absolute;
	width: 1px;
	height: 1px;
	margin: -1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

.bo-skip-menu:focus-within {
	position: fixed;
	top: var(--eh-spacing-1);
	left: var(--eh-spacing-1);
	z-index: 999999;
	padding: var(--eh-spacing-1);
	background-color: var(--eh-color-surface-default);
	border: 1px solid var(--eh-color-border);
	border-radius: var(--eh-radius-md);
	box-shadow: var(--eh-shadow-sm);
}
</style>
