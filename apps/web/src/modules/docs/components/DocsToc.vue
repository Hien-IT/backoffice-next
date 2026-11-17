<script setup lang="ts">
// Backoffice (spec 033, FR-005, Q-50): "On this page", the headings of the open documentation page. The heading being
// read is marked while scrolling (IntersectionObserver on the viewport: the page scrolls on the document); a click
// replaces the hash, DocsRoute scrolls. The mark is a start border and `aria-current`, not colour alone.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { DocsHeading } from '../../../docs/types.ts';
import { useDocsLang } from '../use-docs-lang.ts';

const { headings } = defineProps<{ headings: DocsHeading[] }>();

const router = useRouter();
const { lang } = useDocsLang();
const active = ref<string | null>(null);

let observer: IntersectionObserver | null = null;

function observe() {
	observer?.disconnect();
	observer = null;
	active.value = headings[0]?.id ?? null;

	if (typeof IntersectionObserver === 'undefined' || headings.length === 0) return;

	const visible = new Set<string>();

	// The band under the sticky header down to the middle of the viewport: the first heading in it is the one read.
	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) visible.add(entry.target.id);
				else visible.delete(entry.target.id);
			}

			const first = headings.find((heading) => visible.has(heading.id));
			if (first) active.value = first.id;
		},
		{ rootMargin: '-96px 0px -50% 0px' },
	);

	for (const heading of headings) {
		const element = document.getElementById(heading.id);
		if (element) observer.observe(element);
	}
}

watch(
	() => headings,
	() => void nextTick(observe),
	{ immediate: true },
);

onBeforeUnmount(() => observer?.disconnect());

function go(id: string) {
	active.value = id;
	void router.replace({ hash: `#${id}` });
}

const LINK =
	'block border-s-2 py-1 text-theme-sm no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const CURRENT = 'border-brand-500 text-brand-600 dark:text-brand-400';
const OTHER = 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90';
</script>

<template>
	<nav
		v-if="headings.length"
		class="sticky top-24 max-h-[calc(100dvh-7rem)] self-start overflow-y-auto"
		:aria-label="$t('docs_on_this_page')"
		data-docs-toc
	>
		<p class="mb-2 text-theme-xs font-medium uppercase text-gray-500 dark:text-gray-400">
			{{ $t('docs_on_this_page') }}
		</p>
		<ul class="m-0 list-none p-0" :lang="lang">
			<li v-for="heading in headings" :key="heading.id">
				<a
					:href="`#${heading.id}`"
					:class="[LINK, heading.level === 3 ? 'ps-6' : 'ps-3', active === heading.id ? CURRENT : OTHER]"
					:aria-current="active === heading.id ? 'location' : undefined"
					@click.prevent="go(heading.id)"
				>
					{{ heading.text }}
				</a>
			</li>
		</ul>
	</nav>
</template>
