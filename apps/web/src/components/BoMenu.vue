<script setup lang="ts">
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'reka-ui';
import { computed, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import BoIcon from './BoIcon.vue';
import BoProgressCircular from './BoProgressCircular.vue';
import BoSearchClear from './BoSearchClear.vue';

// `to` = router link, `href` = external link in a new tab, `loading` = spinner in place of the text (screen readers
// still get the text).
export type BoMenuItem = {
	text: string;
	icon?: string | undefined;
	to?: RouteLocationRaw | undefined;
	href?: string | undefined;
	disabled?: boolean;
	loading?: boolean;
	onSelect?: () => void;
	/** The current choice of a pick-one menu (feature 015, aspect ratios): a check and `aria-checked`. */
	active?: boolean;
	/** A separator after this item. */
	divider?: boolean;
	/** A destructive action (DR `.danger` list item): error color. */
	danger?: boolean;
};

// Slot `trigger` is one focusable element (as-child); Reka returns focus to it when the menu closes.
const {
	side = 'bottom',
	align = 'start',
	items,
	searchable = false,
} = defineProps<{
	items: BoMenuItem[];
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
	/** A search row above 10 items (as the select dropdown); it filters on the item text. */
	searchable?: boolean;
}>();

/** Open state, for a caller that reacts to it (the sidebar stays expanded while the user menu is open). */
const open = defineModel<boolean>('open', { default: false });

const search = ref('');
const searchInput = useTemplateRef<HTMLInputElement>('searchInput');
const showSearch = computed(() => searchable && (items.length > 10 || !!search.value));

const visibleItems = computed(() => {
	const value = search.value.toLowerCase();
	if (!value) return items;
	// Dividers split groups of the full list, not of the matches.
	return items.filter((item) => item.text.toLowerCase().includes(value)).map((item) => ({ ...item, divider: false }));
});

function clearSearch() {
	search.value = '';
	searchInput.value?.focus();
}

// Reka focuses the content or the first item on open: the first focus that lands in the menu moves to the search.
let focusSearch = false;

watch(open, (value) => {
	focusSearch = value;
	search.value = '';
});

function onContentFocusin() {
	if (!focusSearch) return;
	focusSearch = false;
	searchInput.value?.focus();
}

// Typed characters (and Home/End) stay in the search input instead of the Reka typeahead. Arrows go to the first or
// last match here: Reka's arrow navigation finds nothing when a single item is left (findNextFocusableElement).
function onSearchKeydown(event: KeyboardEvent) {
	if (event.key.length === 1 || event.key === 'Home' || event.key === 'End') event.stopPropagation();
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
	const menu = (event.currentTarget as HTMLElement).closest('[role="menu"]');
	const matches = [...(menu?.querySelectorAll<HTMLElement>('[data-reka-collection-item]:not([data-disabled])') ?? [])];
	const item = event.key === 'ArrowDown' ? matches[0] : matches.at(-1);
	if (!item) return;
	event.preventDefault();
	event.stopPropagation();
	item.focus();
}

const SEARCH =
	'h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400';
</script>

<template>
	<DropdownMenuRoot v-model:open="open">
		<DropdownMenuTrigger as-child>
			<slot name="trigger" />
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent
				:side="side"
				:align="align"
				:side-offset="4"
				class="custom-scrollbar z-99999 max-h-(--reka-dropdown-menu-content-available-height) min-w-40 space-y-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
				@focusin="onContentFocusin"
			>
				<!-- Sticky over the content padding, so the items scroll under it. -->
				<div v-if="showSearch" class="sticky -top-2 -mx-2 -mt-2 bg-white p-2 dark:bg-gray-dark">
					<div class="relative">
						<input
							ref="searchInput"
							v-model="search"
							type="search"
							autocomplete="off"
							:aria-label="$t('search')"
							:placeholder="$t('search')"
							:class="[SEARCH, { 'pe-10!': search }]"
							@keydown="onSearchKeydown"
						/>
						<BoSearchClear v-if="search" @click="clearSearch" />
					</div>
				</div>
				<p v-if="search && visibleItems.length === 0" class="px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400">
					{{ $t('no_results') }}
				</p>
				<!-- Keyed by text too: a list that changes must not patch a link item into a plain one (as-child). -->
				<template v-for="(item, index) in visibleItems" :key="`${index}-${item.text}`">
					<DropdownMenuItem
						:as-child="item.to !== undefined || !!item.href"
						v-bind="item.active === undefined ? {} : { role: 'menuitemradio', 'aria-checked': item.active }"
						:disabled="!!item.disabled"
						:class="{ 'text-error-600! dark:text-error-500!': item.danger && !item.disabled }"
						class="flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 no-underline outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300"
						@select="item.onSelect?.()"
					>
						<component
							:is="item.to !== undefined ? RouterLink : 'a'"
							v-if="item.to !== undefined || item.href"
							v-bind="
								item.to !== undefined
									? { to: item.to }
									: { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
							"
						>
							<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ item.text }}
						</component>
						<template v-else>
							<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
							<template v-if="item.loading">
								<BoProgressCircular indeterminate aria-hidden="true" />
								<span class="sr-only">{{ item.text }}</span>
							</template>
							<template v-else>{{ item.text }}</template>
							<BoIcon v-if="item.active" name="check" size="sm" class="ms-auto text-brand-500 dark:text-brand-400" />
						</template>
					</DropdownMenuItem>
					<DropdownMenuSeparator v-if="item.divider" class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
				</template>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
