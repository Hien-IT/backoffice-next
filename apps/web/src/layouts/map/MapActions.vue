<!-- Ported from directus/app/src/layouts/map/actions.vue -->
<script setup lang="ts">
// Backoffice: the count line is a `role="status"` region like the tabular actions (FR-115b). Keyboard path of the map
// clicks and box select (D-69, recipe Q-6): a popover "Items in view" lists up to 100 items of the map as buttons that
// open the item, or select it in select mode (handleClick: replaces for a single select, adds for multiple).
import type { Field, Item, PrimaryKey, ShowSelect } from '@directus/types';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		showingCount?: string | undefined;
		collection?: string;
		items?: Item[];
		template?: string;
		primaryKeyField?: Field | null;
		selection?: PrimaryKey[];
		selectMode?: boolean;
		showSelect?: ShowSelect;
		handleClick?: (event: { id: PrimaryKey; replace: boolean }) => void;
	}>(),
	{
		showingCount: undefined,
		collection: '',
		items: () => [],
		template: '',
		primaryKeyField: null,
		selection: () => [],
		selectMode: false,
		showSelect: 'multiple',
		handleClick: () => undefined,
	},
);

const MAX_ITEMS = 100;

const listed = computed(() => {
	const pk = props.primaryKeyField?.field;
	if (!pk) return [];
	return props.items.slice(0, MAX_ITEMS).map((item) => ({ id: item[pk] as PrimaryKey, item }));
});

function choose(id: PrimaryKey) {
	props.handleClick({ id, replace: props.showSelect !== 'multiple' });
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<span
		role="status"
		aria-live="polite"
		class="sr-only whitespace-nowrap text-theme-sm text-gray-500 sm:not-sr-only dark:text-gray-400"
	>
		<template v-if="showingCount">{{ showingCount }}</template>
	</span>

	<PopoverRoot v-if="listed.length > 0">
		<PopoverTrigger
			class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
			:class="FOCUS"
			:aria-label="$t('map_items_in_view')"
			:title="$t('map_items_in_view')"
			data-action="items-in-view"
		>
			<BoIcon name="list" size="sm" />
		</PopoverTrigger>
		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="end"
				:collision-padding="8"
				class="z-99999 max-h-80 w-80 overflow-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark"
			>
				<p class="px-2 py-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
					{{ $t('map_items_in_view') }}
				</p>
				<ul class="flex flex-col gap-0.5">
					<li v-for="{ id, item } in listed" :key="id">
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-theme-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
							:class="FOCUS"
							:aria-pressed="selectMode ? selection.includes(id) : undefined"
							:data-item="id"
							@click="choose(id)"
						>
							<BoIcon
								v-if="selectMode"
								:name="selection.includes(id) ? 'check_box' : 'check_box_outline_blank'"
								size="sm"
								class="text-brand-500 dark:text-brand-400"
							/>
							<RenderTemplate :template="template" :item="item" :collection="collection" />
						</button>
					</li>
				</ul>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
