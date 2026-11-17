<script setup lang="ts">
// Backoffice (spec 033, D-215, Q-50; research R1–R5): the documentation area, `/docs` and every page under it. No DR
// counterpart. The page is found in docs/nav.ts by the route path; its content is loaded on demand (a Markdown file, or
// the variables of one configuration group) and shown in the usual shell: the documentation menu in the sidebar
// `navigation` slot, the article, and the "On this page" column from `xl`. While another page loads, the page shown
// stays; the first load shows skeleton lines. The content is in the docs language (useDocsLang: Vietnamese for vi-VN,
// English otherwise, amendment 2026-11-18): the same page reloads in the other language when the app language changes.
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoNotice from '../../../components/BoNotice.vue';
import '../../../docs/docs.css';
import { findPage, locate, neighbours, normalizePath } from '../../../docs/nav.ts';
import { createSlugger, renderDoc } from '../../../docs/render.ts';
import type {
	ConfigTable,
	DocsApiResource,
	DocsHeading,
	DocsLang,
	DocsPage,
	SupportedGenerated,
} from '../../../docs/types.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import DocsApiPage from '../components/DocsApiResource.vue';
import DocsArticle from '../components/DocsArticle.vue';
import DocsConfigGroup from '../components/DocsConfigGroup.vue';
import DocsNavigation from '../components/DocsNavigation.vue';
import DocsPager from '../components/DocsPager.vue';
import DocsToc from '../components/DocsToc.vue';
import { useDocsLang } from '../use-docs-lang.ts';

type Content = { page: DocsPage; lang: DocsLang; headings: DocsHeading[] } & (
	| { kind: 'markdown'; html: string }
	| { kind: 'api'; resource: DocsApiResource }
	| { kind: 'configuration'; tables: ConfigTable[]; defaults: Record<string, string | undefined> }
);

// One lazy chunk per Markdown page (English under content/en/); the images are assets, only their URLs are in this
// chunk (research R4), the English screenshots under images/en/ with the same file names.
const markdownFiles = import.meta.glob<string>('../../../docs/content/**/*.md', { query: '?raw', import: 'default' });
// One lazy chunk per API resource and language (research R7).
const apiFiles = import.meta.glob<DocsApiResource>(['../../../docs/api/generated/**/*.json', '!**/index.json'], {
	import: 'default',
});
const imageUrls = import.meta.glob<string>('../../../docs/content/images/**/*.png', {
	eager: true,
	query: '?url',
	import: 'default',
});
const imagesOf = (lang: DocsLang) =>
	Object.fromEntries(
		Object.entries(imageUrls)
			.filter(([file]) => file.includes('/images/en/') === (lang === 'en'))
			.map(([file, url]) => [`images/${file.split('/').pop()}`, url]),
	);
const images = { vi: imagesOf('vi'), en: imagesOf('en') };
const dir = (lang: DocsLang) => (lang === 'en' ? 'en/' : '');

const route = useRoute();
const { t } = useI18n();
const { lang, nav } = useDocsLang();

const path = computed(() => normalizePath(route.params['path'] as string | string[] | undefined));
const page = computed(() => findPage(path.value, nav.value));

const content = shallowRef<Content | null>(null);
const loading = ref(false);
const failed = ref(false);

/** The page on screen: the loaded one while the next loads, otherwise the page of the route. */
const shown = computed(() => (page.value && content.value && loading.value ? content.value.page : page.value));
const ready = computed(() =>
	content.value && shown.value && content.value.page.path === shown.value.path ? content.value : null,
);

const title = computed(() => shown.value?.title ?? t('page_not_found'));

const crumbs = computed(() => {
	if (!shown.value) return [];
	const { section, group } = locate(shown.value.path, nav.value);
	return [section ? t(section.titleKey) : null, group?.title ?? null].filter((crumb): crumb is string => !!crumb);
});

const around = computed(() => (shown.value ? neighbours(shown.value.path, nav.value) : {}));

async function build(target: DocsPage, lang: DocsLang): Promise<Content> {
	if (target.kind === 'api') {
		const loadResource = apiFiles[`../../../docs/api/generated/${dir(lang)}${target.source}.json`];
		if (!loadResource) throw new Error(`docs: no API resource "${target.source}"`);
		const resource = await loadResource();

		return {
			page: target,
			lang,
			kind: 'api',
			resource,
			headings: resource.operations.map((operation) => ({
				id: operation.anchor,
				text: operation.summary,
				level: 2 as const,
			})),
		};
	}

	if (target.kind === 'configuration') {
		const [configTables, supported] = await Promise.all([
			lang === 'en'
				? import('../../../docs/configuration/variables.en.ts').then((module) => module.configTablesEn)
				: import('../../../docs/configuration/variables.ts').then((module) => module.configTables),
			import('../../../docs/configuration/supported.generated.json').then(
				(module) => module.default as SupportedGenerated,
			),
		]);
		const tables = configTables[target.source] ?? [];
		const slug = createSlugger();

		return {
			page: target,
			lang,
			kind: 'configuration',
			tables,
			defaults: Object.fromEntries(supported.variables.map((variable) => [variable.pattern, variable.default])),
			headings: tables
				.filter((table) => table.title)
				.map((table) => ({ id: slug(table.title!), text: table.title!, level: 2 as const })),
		};
	}

	const load = markdownFiles[`../../../docs/content/${dir(lang)}${target.source}.md`];
	if (!load) throw new Error(`docs: no content for "${target.path}"`);

	const { html, headings } = renderDoc(await load(), {
		images: images[lang],
		base: import.meta.env.BASE_URL,
		labels: { copy: t('copy'), copyLink: t('docs_copy_link'), note: t('docs_note'), warning: t('docs_warning') },
	});

	return { page: target, lang, kind: 'markdown', html, headings };
}

const reducedMotion = () =>
	typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * To the heading of the hash (focused for the keyboard and screen readers); an unknown anchor leaves the page as is.
 * `smooth` only for a jump inside the page on screen: after a load the jump is instant (a smooth scroll started while
 * the page still lays out is cut short, seen in the browser 2026-11-17), and never under reduced motion.
 */
function scrollToHash(smooth: boolean): boolean {
	if (!route.hash) return false;

	const target = document.getElementById(decodeURIComponent(route.hash.slice(1)));
	if (!target) return false;

	target.scrollIntoView({ behavior: smooth && !reducedMotion() ? 'smooth' : 'auto', block: 'start' });
	target.focus({ preventScroll: true });
	return true;
}

let loads = 0;

async function load(changed: boolean) {
	const target = page.value;
	const current = ++loads;

	failed.value = false;

	if (!target) {
		content.value = null;
		loading.value = false;
		return;
	}

	loading.value = true;

	try {
		const next = await build(target, lang.value);
		if (current !== loads) return;
		content.value = next;
	} catch {
		if (current !== loads) return;
		content.value = null;
		failed.value = true;
	} finally {
		if (current === loads) loading.value = false;
	}

	await nextTick();
	if (current !== loads || scrollToHash(false) || !changed) return;

	// A new page starts at its top, with the focus on its title (the `h1` of the page header).
	window.scrollTo({ top: 0, behavior: 'auto' });
	const heading = document.querySelector<HTMLElement>('#main-content h1');
	heading?.setAttribute('tabindex', '-1');
	heading?.focus({ preventScroll: true });
}

watch(path, (_now, before) => void load(before !== undefined), { immediate: true });
// The same page in the other language: the page on screen stays until the new content is there.
watch(lang, () => void load(false));
watch(
	() => route.hash,
	() => {
		if (!loading.value) scrollToHash(true);
	},
);
</script>

<template>
	<PrivateView :title="title">
		<template #navigation>
			<DocsNavigation />
		</template>

		<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_14rem]" data-docs>
			<div
				class="min-w-0"
				:class="shown?.kind === 'api' ? 'max-w-none' : 'max-w-3xl'"
				:aria-busy="loading && !ready ? 'true' : undefined"
				data-docs-main
			>
				<template v-if="!shown">
					<p class="text-base text-gray-700 dark:text-gray-300">{{ $t('page_not_found_body') }}</p>
					<p class="mt-4">
						<RouterLink
							to="/docs"
							class="text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:focus-visible:outline-brand-400"
						>
							{{ $t('docs_back_home') }}
						</RouterLink>
					</p>
				</template>

				<template v-else>
					<p v-if="crumbs.length" class="mb-2 text-theme-xs text-gray-500 dark:text-gray-400" data-docs-breadcrumb>
						{{ crumbs.join(' / ') }}
					</p>
					<p class="mb-6 text-theme-xl text-gray-500 dark:text-gray-400" :lang="lang" data-docs-lead>
						{{ shown.lead }}
					</p>

					<BoNotice v-if="shown.backofficeOnly" type="info" class="mb-6" data-docs-backoffice-only>
						{{ $t('docs_backoffice_only') }}
					</BoNotice>

					<BoNotice v-if="failed" type="danger" data-docs-error>
						<div class="flex flex-wrap items-center gap-3">
							<span>{{ $t('docs_load_error') }}</span>
							<BoButton variant="secondary" @click="load(false)">{{ $t('docs_retry') }}</BoButton>
						</div>
					</BoNotice>

					<div v-else-if="!ready" class="flex flex-col gap-3" data-docs-loading>
						<span class="sr-only" role="status">{{ $t('loading') }}</span>
						<div
							v-for="width in ['w-2/3', 'w-full', 'w-5/6', 'w-full', 'w-1/2']"
							:key="width"
							class="h-4 animate-pulse rounded bg-gray-200 motion-reduce:animate-none dark:bg-gray-800"
							:class="width"
						/>
					</div>

					<DocsArticle v-else-if="ready.kind === 'markdown'" :html="ready.html" />
					<DocsApiPage v-else-if="ready.kind === 'api'" :resource="ready.resource" />
					<DocsConfigGroup v-else :tables="ready.tables" :headings="ready.headings" :defaults="ready.defaults" />

					<DocsPager :previous="around.previous" :next="around.next" />
				</template>
			</div>

			<DocsToc v-if="ready && ready.headings.length" class="hidden xl:block" :headings="ready.headings" />
		</div>
	</PrivateView>
</template>
