<script setup lang="ts">
// Backoffice (spec 033, FR-003, Q-50): the left menu of the documentation, in the sidebar `navigation` slot. Parts are
// labels, a titled group collapses, a page is a `menu-dropdown-item` link like the Settings sub-menu (layout-patterns
// §12). The group of the open page is always open.
import { ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import { normalizePath, pageLink } from '../../../docs/nav.ts';
import type { DocsGroup, DocsPage } from '../../../docs/types.ts';
import { useDocsLang } from '../use-docs-lang.ts';

const route = useRoute();
const { lang, nav: docsNav } = useDocsLang();

const isActive = (page: DocsPage) => normalizePath(route.params['path'] as string | string[] | undefined) === page.path;

const collapsed = ref(new Set<string>());
const groupKey = (section: string, group: DocsGroup) => `${section}/${group.title ?? ''}`;

const isOpen = (section: string, group: DocsGroup) =>
	!group.title || !collapsed.value.has(groupKey(section, group)) || group.pages.some(isActive);

function toggle(section: string, group: DocsGroup) {
	const key = groupKey(section, group);
	const next = new Set(collapsed.value);

	if (next.has(key)) next.delete(key);
	else next.add(key);

	collapsed.value = next;
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ROW = 'menu-dropdown-item min-h-9 gap-2 py-1 text-sm no-underline';
const PART = 'mb-1 px-3 text-theme-xs font-medium uppercase text-gray-500 dark:text-gray-400';
const GROUP =
	'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border-0 bg-transparent px-3 py-1 text-start text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5';
</script>

<template>
	<nav class="flex flex-col gap-4" :aria-label="$t('documentation')" data-docs-navigation>
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			<li>
				<RouterLink
					:to="pageLink(docsNav.intro)"
					:class="[ROW, FOCUS, isActive(docsNav.intro) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
					:aria-current="isActive(docsNav.intro) ? 'page' : undefined"
				>
					<BoIcon name="menu_book" size="sm" class="shrink-0" />
					<BoTextOverflow :text="docsNav.intro.title" />
				</RouterLink>
			</li>
		</ul>

		<template v-for="section in docsNav.sections" :key="section.id">
			<section v-if="section.groups.some((group) => group.pages.length)" :data-docs-section="section.id">
				<p :class="PART">{{ $t(section.titleKey) }}</p>

				<template v-for="group in section.groups" :key="group.title ?? ''">
					<button
						v-if="group.title"
						type="button"
						:class="[GROUP, FOCUS]"
						:aria-expanded="isOpen(section.id, group)"
						@click="toggle(section.id, group)"
					>
						<span class="truncate">{{ group.title }}</span>
						<BoIcon :name="isOpen(section.id, group) ? 'expand_less' : 'expand_more'" size="sm" class="shrink-0" />
					</button>

					<ul v-show="isOpen(section.id, group)" class="m-0 flex list-none flex-col gap-1 p-0" :lang="lang">
						<li v-for="page in group.pages" :key="page.path">
							<RouterLink
								:to="pageLink(page)"
								:class="[ROW, FOCUS, isActive(page) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
								:aria-current="isActive(page) ? 'page' : undefined"
							>
								<BoTextOverflow :text="page.title" />
							</RouterLink>
						</li>
					</ul>
				</template>
			</section>
		</template>
	</nav>
</template>
