<!-- Ported from directus/app/src/modules/settings/routes/data-model/collections/components/CollectionItem.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-20, layout-patterns §12): the row content of one collection inside a BoSortableList row of the
// page (drag handle and row menu come from BoSortableList), then its children in a nested BoSortableList of the same
// `collections` group, so rows move across levels by mouse drag (Directus vuedraggable) or by the D-96 menu items.
// The row and its children are hidden when a search does not match them or a descendant.
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoSortableList from '../../../../../components/BoSortableList.vue';
import type { Collection } from '../../../../../stores/collections.ts';
import { COLLECTION_TREE } from '../composables/collection-tree.ts';

const props = defineProps<{ collection: Collection }>();

const { t } = useI18n();
const tree = inject(COLLECTION_TREE)!;

const children = computed(() => tree.childrenOf(props.collection.collection));
const visibleChildren = computed(() => children.value.filter((child) => tree.visible(child.collection)));
const collapsed = computed(() => tree.isCollapsed(props.collection.collection));
const searching = computed(() => !!tree.search());

const parts = computed(() => {
	const name = props.collection.collection;
	const query = tree.search()?.toLowerCase();
	const at = query ? name.toLowerCase().indexOf(query) : -1;
	if (!query || at < 0) return [name];
	return [name.slice(0, at), name.slice(at, at + query.length), name.slice(at + query.length)];
});

const iconColor = computed(() => (props.collection.meta?.hidden ? undefined : (props.collection.color ?? undefined)));

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
</script>

<template>
	<div>
		<div class="flex min-h-9 items-center gap-3" :class="{ 'text-gray-400 dark:text-gray-500': collection.meta?.hidden }">
			<component
				:is="collection.schema ? RouterLink : 'button'"
				v-bind="
					collection.schema
						? { to: `/settings/data-model/${collection.collection}` }
						: { type: 'button', onClick: () => tree.editFolder(collection) }
				"
				class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-start no-underline"
				:class="FOCUS"
			>
				<BoIcon
					:name="collection.meta?.hidden ? 'visibility_off' : collection.icon"
					size="sm"
					class="shrink-0"
					:class="iconColor ? '' : collection.meta?.hidden ? 'text-gray-400' : 'text-brand-500'"
					:style="iconColor ? { color: iconColor } : undefined"
				/>
				<span class="font-mono text-theme-sm text-gray-800 dark:text-white/90" :class="{ 'opacity-60': collection.meta?.hidden }">
					<template v-for="(part, index) in parts" :key="index">
						<mark v-if="index === 1" class="rounded-sm bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">{{ part }}</mark>
						<template v-else>{{ part }}</template>
					</template>
				</span>
				<span v-if="collection.meta?.note" class="min-w-0 truncate text-theme-xs text-gray-500 dark:text-gray-400">
					{{ collection.meta.note }}
				</span>
			</component>

			<button
				v-if="children.length > 0"
				type="button"
				:class="ICON_BTN"
				:aria-expanded="!collapsed"
				:aria-label="`${collapsed ? t('expand') : t('collapse')} ${collection.collection}`"
				:title="collapsed ? t('expand') : t('collapse')"
				@click="tree.toggleCollapse(collection.collection)"
			>
				<BoIcon :name="collapsed ? 'unfold_more' : 'unfold_less'" size="sm" />
			</button>
		</div>

		<!-- An empty list stays as a small drop target (BoSortableList `min-h-3`) so a row can be dragged into any collection. -->
		<div
			v-if="!collapsed && (children.length > 0 || !searching)"
			class="ms-2 ps-4"
			:class="children.length > 0 ? 'mt-2 border-s border-gray-100 dark:border-gray-800' : ''"
		>
			<BoSortableList
				:model-value="searching ? visibleChildren : children"
				item-key="collection"
				group="collections"
				tree
				nested
				:disabled="searching"
				:item-label="(item: Collection) => item.collection"
				:row-actions="(item: Collection) => tree.optionsFor(item, tree.childrenOf(item.collection).length > 0)"
				@update:model-value="tree.sortList($event, collection.collection)"
				@change="'added' in $event && tree.dropInto(collection.collection, $event.added)"
				@indent="tree.indent(children, $event, collection.collection)"
				@outdent="tree.outdent(children, $event, collection.collection)"
			>
				<template #item="{ element }">
					<CollectionItem :collection="element" />
				</template>
			</BoSortableList>
		</div>
	</div>
</template>

