<script setup lang="ts">
// Idea from directus/app/src/views/private/components/skip-menu.vue: links hidden until one of them gets keyboard
// focus. The targets (#main-content, #navigation) need tabindex="-1" so focus moves there.
const LINKS = [
	{ hash: '#main-content', key: 'skip_to_content' },
	{ hash: '#navigation', key: 'skip_to_navigation' },
];
</script>

<template>
	<!-- Hidden (sr-only) until a link gets focus, then a dropdown-style panel in the top start corner. -->
	<div
		class="not-focus-within:sr-only focus-within:fixed focus-within:start-1 focus-within:top-1 focus-within:z-999999 focus-within:rounded-2xl focus-within:border focus-within:border-gray-200 focus-within:bg-white focus-within:p-2 focus-within:shadow-theme-lg dark:focus-within:border-gray-800 dark:focus-within:bg-gray-dark"
	>
		<a
			v-for="link in LINKS"
			:key="link.hash"
			:href="link.hash"
			class="block rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		>
			{{ $t(link.key) }}
		</a>
	</div>
</template>
