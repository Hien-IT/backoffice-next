<!-- Ported from directus/app/src/interfaces/presentation-header/helper-text.vue -->
<script setup lang="ts">
// Backoffice: the scoped SCSS for the rich text is a short set of Tailwind arbitrary variants (theme tokens only).
import dompurify from 'dompurify';
import { computed } from 'vue';

interface TextProps {
	content: string;
}

const props = defineProps<TextProps>();

const sanitizedContent = computed(() => dompurify.sanitize(props.content));
</script>

<template>
	<!-- sanitized by DOMPurify (FR-065) -->
	<!-- eslint-disable vue/no-v-html -->
	<div
		v-if="content"
		class="helper-text select-text text-sm text-gray-800 dark:text-white/90 [&_*:not(:last-child):not(li)]:mb-4 [&_a]:text-brand-500 [&_a:hover]:underline dark:[&_a]:text-brand-400 [&_blockquote]:border-s-[3px] [&_blockquote]:border-brand-500 [&_blockquote]:ps-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:font-mono dark:[&_code]:bg-white/5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-2 dark:[&_pre]:bg-white/5 [&_td]:border [&_td]:border-gray-200 [&_td]:p-2 dark:[&_td]:border-gray-800 [&_th]:border [&_th]:border-gray-200 [&_th]:p-2 [&_th]:text-start dark:[&_th]:border-gray-800 [&_ul]:list-disc [&_ul]:ps-6"
		v-html="sanitizedContent"
	/>
	<!-- eslint-enable vue/no-v-html -->
</template>
