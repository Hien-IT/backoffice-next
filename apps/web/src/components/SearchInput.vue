<!-- Ported from directus/app/src/views/private/components/search-input.vue -->
<script setup lang="ts">
// Backoffice: recipe "Search and advanced filter (Q-7)": a pill that widens on focus, buttons instead of clickable
// icons (FR-027), the filter in a Reka Popover anchored to the pill instead of the inline expand (no `main-element`
// width math), the active filter count as a solid primary badge. Menus of the filter are portaled Reka layers
// (`[data-reka-popper-content-wrapper]`), the equivalent of `.v-menu-content` for the focusout rule.
import type { Filter } from '@directus/types';
import { isObject } from 'lodash-es';
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import BoIcon from './BoIcon.vue';

// Backoffice: lazy, it only shows in the popover; a static import closes a cycle (relational interfaces → DrawerCollection
// → SearchInput → SystemFilter → interface registry → the relational interfaces).
const SystemFilter = defineAsyncComponent(() => import('../interfaces/_system/system-filter/SystemFilter.vue'));

const props = withDefaults(
	defineProps<{
		modelValue: string | null;
		disabled?: boolean;
		showFilter?: boolean;
		collection?: string | undefined;
		filter?: Filter | null;
		autofocus?: boolean;
		placeholder?: string | undefined;
	}>(),
	{
		showFilter: true,
		collection: undefined,
		filter: null,
		placeholder: undefined,
	},
);

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | null): void;
	(e: 'update:filter', value: Filter | null): void;
}>();

const MENU_CONTENT = '[data-reka-popper-content-wrapper], [role="menu"], [role="listbox"], [role="dialog"]';

const input = ref<HTMLInputElement | null>(null);

const active = ref(props.autofocus);
const filterActive = ref(false);

onMounted(() => {
	if (active.value) input.value?.focus();
});

const activeFilterCount = computed(() => {
	if (!props.filter) return 0;

	const filterOperators: string[] = [];

	parseLevel(props.filter);

	return filterOperators.length;

	function parseLevel(level: Record<string, any>) {
		for (const [key, value] of Object.entries(level)) {
			if (key === '_and' || key === '_or') {
				value.forEach(parseLevel);
			} else if (key.startsWith('_')) {
				filterOperators.push(key);
			} else {
				if (isObject(value)) {
					parseLevel(value);
				}
			}
		}
	}
});

function activate() {
	if (props.disabled) return;
	if (!active.value) input.value?.focus();
	active.value = true;
}

function onFilterOpen(open: boolean) {
	filterActive.value = open;
	active.value = true;
	if (!open) input.value?.focus();
}

function clear() {
	emit('update:modelValue', null);
	if (active.value) input.value?.focus();
}

function disable() {
	active.value = false;
	filterActive.value = false;
	input.value?.blur();
}

function onFocusOut(event: FocusEvent) {
	// Check if focus is moving to another element inside the search component -- prevents race condition on touch vs click events
	const searchElement = (event.currentTarget as HTMLElement)?.closest('.search-input');
	const relatedTarget = event.relatedTarget as HTMLElement | null;

	if (relatedTarget?.closest(MENU_CONTENT)) return;

	if (relatedTarget && searchElement?.contains(relatedTarget)) return;

	if (filterActive.value && !relatedTarget) return;

	disable();
}

// Backoffice: Reka closes the popover on any interaction outside its content; the pill (anchor) and the portaled menus of
// the filter count as inside, like the focusout rule above.
function onInteractOutside(event: Event) {
	const target = event.target as HTMLElement | null;
	if (!target || target.closest('.search-input') || target.closest(MENU_CONTENT)) event.preventDefault();
}

function emitValue() {
	if (!input.value) return;
	const value = input.value?.value;
	emit('update:modelValue', value);
}

const ICON_BTN =
	'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400';
</script>

<template>
	<PopoverRoot :open="filterActive" @update:open="onFilterOpen">
		<PopoverAnchor as-child>
			<div
				class="search-input relative flex h-11 items-center rounded-full border border-gray-200 bg-white px-1 transition-[width] duration-200 motion-reduce:transition-none dark:border-gray-800 dark:bg-gray-900"
				:class="[
					{ active, disabled, 'filter-active': filterActive, 'has-content': !!modelValue, 'show-filter': showFilter },
					active || modelValue ? 'w-72 max-w-[calc(100vw-2rem)]' : showFilter ? 'w-20' : 'w-11',
				]"
				role="search"
				@click="activate"
				@focusout="onFocusOut"
			>
				<button
					type="button"
					class="icon-search"
					:class="ICON_BTN"
					:disabled
					:aria-label="$t('search')"
					@click.stop="activate"
				>
					<BoIcon name="search" size="sm" />
				</button>
				<input
					ref="input"
					:value="modelValue"
					:placeholder="placeholder ?? $t('search_items')"
					:aria-label="placeholder ?? $t('search_items')"
					type="search"
					spellcheck="false"
					autocapitalize="off"
					autocorrect="off"
					autocomplete="off"
					class="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-gray-800 outline-hidden placeholder:text-gray-500 dark:text-white/90 dark:placeholder:text-gray-400 [&::-webkit-search-cancel-button]:appearance-none"
					:class="{ 'w-0 flex-none p-0': !active && !modelValue }"
					:tabindex="!active && !modelValue ? -1 : undefined"
					:disabled
					@input="emitValue"
					@paste="emitValue"
					@keydown.esc="disable"
					@focusin="activate"
				/>
				<button
					v-if="modelValue"
					type="button"
					class="icon-clear"
					:class="ICON_BTN"
					:disabled
					:aria-label="$t('clear_value')"
					:title="$t('clear_value')"
					@click.stop="clear"
				>
					<BoIcon name="close" size="sm" />
				</button>
				<template v-if="showFilter">
					<PopoverTrigger
						class="icon-filter relative"
						:class="ICON_BTN"
						:disabled
						:aria-label="$t('filter')"
						:title="$t('filter')"
						@click.stop
					>
						<BoIcon name="filter_list" size="sm" />
						<span
							v-if="!disabled && activeFilterCount && !filterActive"
							class="pointer-events-none absolute -end-0.5 -bottom-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-theme-xs leading-4 font-medium text-white"
						>
							{{ activeFilterCount }}
						</span>
					</PopoverTrigger>
				</template>
			</div>
		</PopoverAnchor>

		<PopoverPortal v-if="showFilter">
			<PopoverContent
				align="end"
				:side-offset="8"
				class="z-99999 w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-700 dark:bg-gray-800"
				@escape-key-down="disable"
				@interact-outside="onInteractOutside"
			>
				<SystemFilter inline :value="filter" :collection-name="collection" @input="emit('update:filter', $event)" />
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
