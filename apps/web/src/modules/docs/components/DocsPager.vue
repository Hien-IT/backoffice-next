<script setup lang="ts">
// Backoffice (spec 033, FR-008, Q-50): the previous and next page of the documentation, in menu order.
import { RouterLink } from 'vue-router';
import { pageLink } from '../../../docs/nav.ts';
import type { DocsPage } from '../../../docs/types.ts';

defineProps<{ previous?: DocsPage | undefined; next?: DocsPage | undefined }>();

const CARD =
	'flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-gray-200 p-4 no-underline hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:hover:bg-white/[0.03] dark:focus-visible:outline-brand-400';
const LABEL = 'text-theme-xs text-gray-500 dark:text-gray-400';
const NAME = 'truncate text-theme-sm font-medium text-gray-800 dark:text-white/90';
</script>

<template>
	<nav v-if="previous || next" class="mt-12 flex gap-4" :aria-label="$t('docs_pager')">
		<RouterLink v-if="previous" :to="pageLink(previous)" :class="CARD" rel="prev" data-docs-previous>
			<span :class="LABEL">{{ $t('docs_previous') }}</span>
			<span :class="NAME" lang="vi">{{ previous.title }}</span>
		</RouterLink>
		<span v-else class="flex-1" />
		<RouterLink v-if="next" :to="pageLink(next)" :class="[CARD, 'items-end text-end']" rel="next" data-docs-next>
			<span :class="LABEL">{{ $t('docs_next') }}</span>
			<span :class="NAME" lang="vi">{{ next.title }}</span>
		</RouterLink>
		<span v-else class="flex-1" />
	</nav>
</template>
