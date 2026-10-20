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
import { displayCollectionKey, isUntranslatedKey } from '../../../../../utils/display-collection-key.ts';
import { COLLECTION_TREE, folderRowClass } from '../composables/collection-tree.ts';

const props = defineProps<{ collection: Collection }>();

const { t } = useI18n();
const tree = inject(COLLECTION_TREE)!;

const children = computed(() => tree.childrenOf(props.collection.collection));
const visibleChildren = computed(() => children.value.filter((child) => tree.visible(child.collection)));
const collapsed = computed(() => tree.isCollapsed(props.collection.collection));
const searching = computed(() => !!tree.search());
// An empty folder shows a visible drop area; an empty collection keeps a drop target without layout height.
const emptyFolder = computed(() => !props.collection.schema && children.value.length === 0);

const parts = computed(() => {
	const name = displayCollectionKey(props.collection.collection);
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
		<div
			class="flex min-h-9 items-center gap-3"
			:class="{ 'text-gray-500 dark:text-gray-400': collection.meta?.hidden }"
		>
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
					:class="
						iconColor
							? ''
							: collection.meta?.hidden
								? 'text-gray-500 dark:text-gray-400'
								: 'text-brand-600 dark:text-brand-400'
					"
					:style="iconColor ? { color: iconColor } : undefined"
				/>
				<!-- A hidden collection is dimmed with the FR-106 muted colors (gray-500 / gray-400), not opacity. -->
				<span
					class="font-mono text-theme-sm"
					:class="collection.meta?.hidden ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-white/90'"
				>
					<template v-for="(part, index) in parts" :key="index">
						<mark
							v-if="index === 1"
							class="rounded-sm bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
						>
							{{ part }}
						</mark>
						<template v-else>{{ part }}</template>
					</template>
				</span>
				<span
					v-if="collection.meta?.note && !isUntranslatedKey(collection.meta.note)"
					class="min-w-0 truncate text-theme-xs text-gray-500 dark:text-gray-400"
				>
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

		<!-- An empty list stays as a small drop target (BoSortableList `min-h-3`) so a row can be dragged into any collection.
		     It takes no layout height (`h-0`, overflowing into the row padding), so the row stays centred on its handle; an
		     empty folder shows a dashed drop area with a hint instead (owner 2026-10-21). -->
		<div
			v-if="!collapsed && (children.length > 0 || !searching)"
			class="ms-2 ps-4"
			:class="
				children.length > 0
					? 'mt-2 border-s border-gray-100 dark:border-gray-800'
					: emptyFolder
						? 'relative mt-2 mb-1'
						: 'h-0'
			"
		>
			<p
				v-if="emptyFolder"
				class="pointer-events-none absolute inset-0 m-0 flex items-center justify-center ps-4 text-theme-xs text-gray-500 dark:text-gray-400"
			>
				{{ t('drop_collections_here') }}
			</p>
			<BoSortableList
				:model-value="searching ? visibleChildren : children"
				item-key="collection"
				group="collections"
				tree
				nested
				:disabled="searching"
				:item-label="(item: Collection) => item.collection"
				:row-actions="(item: Collection) => tree.optionsFor(item, tree.childrenOf(item.collection).length > 0)"
				:row-class="folderRowClass"
				:list-class="
					emptyFolder
						? 'space-y-2 min-h-10 rounded-lg border border-dashed border-gray-300 dark:border-gray-700'
						: 'space-y-2'
				"
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
