<script setup lang="ts">
// Backoffice (spec 033, FR-010, FR-039, FR-046): a Markdown page of the documentation. `html` comes from docs/render.ts,
// which sanitizes it (DOMPurify) before it gets here. Clicks are handled here, as the content is not Vue: copy buttons
// of the code blocks, the copy-link sign of a heading, links to other documentation pages and to anchors.
import { useRouter } from 'vue-router';
import { useCopy } from '../copy.ts';
import { useDocsLang } from '../use-docs-lang.ts';

defineProps<{ html: string }>();

const router = useRouter();
const { lang } = useDocsLang();
const { announced, copy } = useCopy();

function onClick(event: MouseEvent) {
	const target = event.target instanceof Element ? event.target : null;
	if (!target) return;

	const copyButton = target.closest('[data-copy]');

	if (copyButton) {
		void copy(copyButton.closest('.docs-code')?.querySelector('code')?.textContent ?? '');
		return;
	}

	const link = target.closest('a');
	// A click with a modifier (new tab, new window) stays the browser's.
	if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

	const href = link.getAttribute('href') ?? '';

	if (href.startsWith('#')) {
		event.preventDefault();
		if (link.classList.contains('docs-anchor')) void copy(new URL(href, window.location.href).toString());
		void router.replace({ hash: href });
		return;
	}

	const base = router.options.history.base;

	if (href === `${base}/docs` || href.startsWith(`${base}/docs/`) || href.startsWith(`${base}/docs#`)) {
		event.preventDefault();
		void router.push(href.slice(base.length));
	}
}
</script>

<template>
	<div>
		<!-- The content is in the docs language: Vietnamese for vi-VN, English otherwise (FR-039, amendment 2026-11-18). -->
		<!-- eslint-disable-next-line vue/no-v-html -->
		<div class="docs-article" :lang="lang" @click="onClick" v-html="html" />
		<span class="sr-only" aria-live="polite">{{ announced }}</span>
	</div>
</template>
