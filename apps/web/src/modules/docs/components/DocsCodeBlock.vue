<script setup lang="ts">
// Backoffice (spec 033, FR-010a, Q-50): a code block with syntax colours and a copy button. The same markup as the
// blocks of a Markdown page (docs/render.ts), for the pages built from data (API examples).
import { computed } from 'vue';
import { highlight } from '../../../docs/highlight.ts';
import { sanitize } from '../../../utils/markdown.ts';
import { useCopy } from '../copy.ts';

const { code, language = null } = defineProps<{ code: string; language?: string | null }>();

const { announced, copy } = useCopy();

// highlight.js output (or escaped text) through the app sanitizer before v-html (FR-046).
const html = computed(() => sanitize(highlight(code, language)));
</script>

<template>
	<div class="docs-code">
		<!-- eslint-disable-next-line vue/no-v-html -->
		<pre tabindex="0"><code class="hljs" :data-lang="language ?? undefined" v-html="html" /></pre>
		<button type="button" class="docs-copy" @click="copy(code)">{{ $t('copy') }}</button>
		<span class="sr-only" aria-live="polite">{{ announced }}</span>
	</div>
</template>
