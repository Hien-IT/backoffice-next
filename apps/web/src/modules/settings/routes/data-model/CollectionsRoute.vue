<!-- Ported from directus/app/src/modules/settings/routes/data-model/collections/collections.vue; Ported from directus/app/src/modules/settings/routes/data-model/collections/components/collection-options.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US1, FR-010 to FR-019, recipe Q-20 of layout-patterns §12):
// - The tree rows are BoSortableList rows of the `collections` group (mouse drag across levels like DR
//   vuedraggable), with the D-96 keyboard items in the row menu after the collection options. The order is saved as
//   DR onSort: the store first, then PATCH /collections with `{ collection, meta: { sort, group } }` of the whole
//   target list, not awaited and errors not shown (Clarifications 2026-10-16).
// - While searching, rows that do not match (nor a descendant) are left out and dragging is off, so a sort never saves
//   an order with hidden rows in it.
// - The collection options menu (collection-options.vue) is built here and given to the rows; the delete dialog is
//   DeleteCollectionDialog.vue. Errors of the store actions go to the error dialog (D-66).
import { merge } from 'lodash-es';
import { computed, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoDetail from '../../../../components/BoDetail.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import type { BoMenuItem } from '../../../../components/BoMenu.vue';
import BoMenu from '../../../../components/BoMenu.vue';
import BoSortableList from '../../../../components/BoSortableList.vue';
import SearchInput from '../../../../components/SearchInput.vue';
import PrivateView from '../../../../layout/PrivateView.vue';
import { type Collection, useCollectionsStore } from '../../../../stores/collections.ts';
import { displayCollectionKey, isUntranslatedKey } from '../../../../utils/display-collection-key.ts';
import { getCollectionRoute } from '../../../../utils/get-item-route.ts';
import { translate } from '../../../../utils/translate-object-values.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import CollectionDialog from './components/CollectionDialog.vue';
import CollectionItem from './components/CollectionItem.vue';
import DeleteCollectionDialog from './components/DeleteCollectionDialog.vue';
import SnapshotSidebarDetail from './components/SnapshotSidebarDetail.vue';
import { COLLECTION_TREE, folderRowClass } from './composables/collection-tree.ts';
import { useExpandCollapse } from './composables/use-expand-collapse.ts';

const { t } = useI18n();
const collectionsStore = useCollectionsStore();
const { collapsedIds, hasExpandableCollections, expandAll, collapseAll, toggleCollapse } = useExpandCollapse();

const search = ref<string | null>(null);
const createFolderActive = ref(false);
const editCollection = ref<Collection | null>(null);
const deleteTarget = ref<Collection | null>(null);

const isSystem = (collection: string) => collection.startsWith('directus_');

const collections = computed(
	() => translate(collectionsStore.allCollections.filter((collection) => collection.meta)) as Collection[],
);

const childrenOf = (parent: string | null) =>
	collections.value.filter((collection) => (collection.meta?.group ?? null) === parent);

const rootCollections = computed(() => childrenOf(null));

/** DR visibilityTree: a collection matches the search, or one of its descendants does. */
const visibleIds = computed(() => {
	const query = search.value?.toLowerCase();
	const all = collectionsStore.sortedCollections;
	const result = new Set<string>();

	const visit = (parent: string | null): boolean => {
		let any = false;

		for (const collection of all.filter((c) => (c.meta?.group ?? null) === parent)) {
			const childVisible = visit(collection.collection);
			const visible =
				!query || displayCollectionKey(collection.collection).toLowerCase().includes(query) || childVisible;
			if (visible) result.add(collection.collection);
			any ||= visible;
		}

		return any;
	};

	visit(null);
	return result;
});

const visible = (collection: string) => visibleIds.value.has(collection);

const tableCollections = computed(
	() => translate(collectionsStore.databaseCollections.filter((collection) => !collection.meta)) as Collection[],
);

// Backoffice (spec 022, D-181, owner 2026-10-26): backoffice_migrations is left out, its D-118 key would repeat the
// one shown for directus_migrations; spec 025 (D-189.5): backoffice_permissions too (directus_permissions).
const systemCollections = computed(
	() =>
		translate(
			collectionsStore.systemCollections
				.filter(({ collection }) => !['backoffice_migrations', 'backoffice_permissions'].includes(collection))
				.map((collection) => ({ ...collection, icon: 'settings' })),
		) as Collection[],
);

function sortList(list: Collection[], parent: string | null) {
	const updates = list.map((collection, index) => ({
		collection: collection.collection,
		meta: { sort: index + 1, group: parent },
	}));

	collectionsStore.collections = collectionsStore.collections.map((collection) => {
		const update = updates.find((u) => u.collection === collection.collection);
		return update ? merge({}, collection, update) : collection;
	});

	// Not awaited and errors not shown, as DR onSort (spec FR-012, Clarifications 2026-10-16).
	sdk.request(requestEndpoint('/collections', { method: 'PATCH', body: updates })).catch(() => undefined);
}

function dropInto(parent: string | null, added: { newIndex: number; element: Collection }) {
	const list = childrenOf(parent).filter((c) => c.collection !== added.element.collection);
	list.splice(added.newIndex, 0, added.element);
	sortList(list, parent);
}

function indent(list: Collection[], index: number) {
	const above = list[index - 1];
	const item = list[index];
	if (!above || !item) return;
	sortList([...childrenOf(above.collection).filter((c) => c.collection !== item.collection), item], above.collection);
}

function outdent(list: Collection[], index: number, parent: string | null) {
	const item = list[index];
	if (!item || parent === null) return;
	const grandparent = collectionsStore.getCollection(parent)?.meta?.group ?? null;
	const siblings = childrenOf(grandparent).filter((c) => c.collection !== item.collection);
	siblings.splice(siblings.findIndex((c) => c.collection === parent) + 1, 0, item);
	sortList(siblings, grandparent);
}

const update = (collection: Collection, meta: Record<string, unknown>) =>
	collectionsStore.updateCollection(collection.collection, { meta } as never);

/** collection-options.vue: the menu of a collection row (none for system collections). */
function optionsFor(collection: Collection, hasNested: boolean): BoMenuItem[] {
	if (isSystem(collection.collection)) return [];

	const folderish = collection.type === 'alias' || hasNested;
	const hidden = collection.meta?.hidden === false;

	const items: BoMenuItem[] = [];

	if (collection.schema)
		items.push({ text: t('goto_collection_content'), icon: 'box', to: getCollectionRoute(collection.collection) });

	items.push({
		text: hidden
			? t(collection.schema ? 'make_collection_hidden' : 'make_folder_hidden')
			: t(collection.schema ? 'make_collection_visible' : 'make_folder_visible'),
		icon: hidden ? 'visibility_off' : 'visibility',
		divider: true,
		onSelect: () => update(collection, { hidden: !collection.meta?.hidden }),
	});

	if (folderish) {
		items.push(
			...(
				[
					['open', 'start_open', 'folder_open'],
					['closed', 'start_collapsed', 'folder'],
					['locked', 'always_open', 'folder_lock'],
				] as const
			).map(([value, label, icon], i) => ({
				text: t(label),
				icon,
				active: collection.meta?.collapse === value,
				divider: i === 2,
				onSelect: () => update(collection, { collapse: value }),
			})),
		);
	}

	items.push({
		text: collection.schema ? t('delete_collection') : t('delete_folder'),
		icon: 'delete',
		divider: true,
		onSelect: () => (deleteTarget.value = collection),
	});

	return items;
}

provide(COLLECTION_TREE, {
	collections: () => collections.value,
	childrenOf,
	visible,
	search: () => search.value,
	isCollapsed: (collection) => collapsedIds.value.includes(collection),
	toggleCollapse,
	sortList,
	dropInto,
	indent,
	outdent,
	optionsFor,
	editFolder: (collection) => (editCollection.value = collection),
});

const searching = computed(() => !!search.value);
const shownRoots = computed(() =>
	searching.value ? rootCollections.value.filter((c) => visible(c.collection)) : rootCollections.value,
);
const deleteOpen = computed({
	get: () => deleteTarget.value !== null,
	set: (value) => {
		if (!value) deleteTarget.value = null;
	},
});
const editOpen = computed({
	get: () => editCollection.value !== null,
	set: (value) => {
		if (!value) editCollection.value = null;
	},
});

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const TEXT_BTN = `rounded px-1 text-brand-500 hover:text-brand-600 dark:text-brand-400 ${FOCUS}`;
</script>

<template>
	<PrivateView
		:title="$t('settings_data_model')"
		icon="database"
		:breadcrumb="[{ name: $t('settings'), to: '/settings' }]"
	>
		<template #actions>
			<SearchInput
				v-model="search"
				:show-filter="false"
				:autofocus="collectionsStore.collections.length - systemCollections.length > 25"
				:placeholder="$t('search_collection')"
			/>
			<BoButton
				variant="secondary"
				icon="create_new_folder"
				:aria-label="$t('create_folder')"
				:title="$t('create_folder')"
				@click="createFolderActive = true"
			/>
			<BoButton
				icon="add"
				:to="{ name: 'settings-add-new' }"
				:aria-label="$t('create_collection')"
				:title="$t('create_collection')"
			/>
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="flex max-w-5xl flex-col gap-6">
			<BoInfo v-if="collections.length === 0" icon="box" :title="$t('no_collections')">
				{{ $t('no_collections_copy_admin') }}
				<template #append>
					<BoButton :to="{ name: 'settings-add-new' }">{{ $t('create_collection') }}</BoButton>
				</template>
			</BoInfo>

			<section v-else :aria-label="$t('settings_data_model')">
				<p v-if="hasExpandableCollections" class="m-0 mb-3 text-theme-sm text-gray-500 dark:text-gray-400">
					{{ $t('expand') }}
					<button type="button" :class="TEXT_BTN" @click="expandAll">{{ $t('all') }}</button>
					/
					<button type="button" :class="TEXT_BTN" @click="collapseAll">{{ $t('none') }}</button>
				</p>

				<BoSortableList
					:model-value="shownRoots"
					item-key="collection"
					group="collections"
					tree
					:disabled="searching"
					:item-label="(item: Collection) => item.collection"
					:row-actions="(item: Collection) => optionsFor(item, childrenOf(item.collection).length > 0)"
					:row-class="folderRowClass"
					@update:model-value="sortList($event, null)"
					@change="'added' in $event && dropInto(null, $event.added)"
					@indent="indent(rootCollections, $event)"
				>
					<template #item="{ element }">
						<CollectionItem :collection="element" />
					</template>
				</BoSortableList>
			</section>

			<section
				v-if="tableCollections.some((c) => visible(c.collection))"
				:aria-label="$t('db_only_click_to_configure')"
			>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					<template v-for="collection in tableCollections" :key="collection.collection">
						<li
							v-if="visible(collection.collection)"
							class="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-gray-500 dark:border-gray-700 dark:text-gray-400"
							:title="$t('db_only_click_to_configure')"
						>
							<BoIcon name="add" size="sm" />
							<RouterLink
								:to="{ name: 'settings-fields', params: { collection: collection.collection } }"
								class="flex min-w-0 flex-1 items-center gap-3 rounded-lg no-underline"
								:class="FOCUS"
							>
								<BoIcon name="dns" size="sm" />
								<span class="font-mono text-theme-sm">{{ collection.name }}</span>
							</RouterLink>
							<BoMenu :items="optionsFor(collection, false)" align="end">
								<template #trigger>
									<button
										type="button"
										class="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
										:class="FOCUS"
										:aria-label="$t('item_options', { item: collection.collection })"
									>
										<BoIcon name="more_vert" size="sm" />
									</button>
								</template>
							</BoMenu>
						</li>
					</template>
				</ul>
			</section>

			<BoDetail
				v-show="systemCollections.some((collection) => visible(collection.collection))"
				:title="$t('system_collections')"
			>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					<template v-for="collection in systemCollections" :key="collection.collection">
						<li v-if="visible(collection.collection)">
							<RouterLink
								:to="`/settings/data-model/${collection.collection}`"
								class="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 no-underline dark:border-gray-800 dark:bg-white/[0.03]"
								:class="FOCUS"
							>
								<BoIcon name="settings" size="sm" class="text-brand-500" />
								<span class="font-mono text-theme-sm text-gray-800 dark:text-white/90">
									{{ displayCollectionKey(collection.collection) }}
								</span>
								<span
									v-if="collection.meta?.note && !isUntranslatedKey(collection.meta.note)"
									class="truncate text-theme-xs text-gray-500 dark:text-gray-400"
								>
									{{ collection.meta.note }}
								</span>
							</RouterLink>
						</li>
					</template>
				</ul>
			</BoDetail>
		</div>

		<RouterView name="add" />

		<template #sidebar>
			<SnapshotSidebarDetail />
		</template>

		<CollectionDialog v-model:open="createFolderActive" />
		<CollectionDialog v-model:open="editOpen" :collection="editCollection" />
		<DeleteCollectionDialog v-if="deleteTarget" v-model:open="deleteOpen" :collection="deleteTarget" />
	</PrivateView>
</template>
