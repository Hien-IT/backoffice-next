<!-- Ported from directus/app/src/views/private/components/notifications-drawer.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-071 to FR-077, research R8, recipe Q-39): BoDrawer on `appStore.notificationsDrawerOpen`,
// mounted once by PrivateView as a lazy chunk (`data-notifications-drawer`, FR-109). Differences from Directus:
// - the Inbox/Archive tabs and the Activity link (to `/activity`) are a vertical BoTabs in the drawer body (horizontal
//   below `lg`), with the list as the tab panel, instead of the VDrawer sidebar;
// - Archive/Unarchive and load errors open the error dialog (Directus does not catch them), Delete errors too
//   (Directus: try/finally only); selection and dialog state after an error stay as in Directus (R-57);
// - the request client is the SDK (useItems port); DELETE sends the key array (api-calls row 203);
// - rows are NotificationItem (checkbox, highlight, relative time, open and expand buttons as buttons);
// - no list of unfinished TUS uploads (Directus 11.17.4 has none either, FR-076).
// The counts come from the memoized aggregate of useItems, as in Directus: they are not requested again after a write.
import { useMediaQuery } from '@vueuse/core';
import type { Filter } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useItems } from '../composables/use-items.ts';
import { showUnexpectedError } from '../composables/use-notices.ts';
import { useAppStore } from '../stores/app.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useUserStore } from '../stores/user.ts';
import { formatItemsCountPaginated } from '../utils/format-items-count.ts';
import { getCollectionRoute, getItemRoute } from '../utils/get-item-route.ts';
import BoButton from './BoButton.vue';
import BoCheckbox from './BoCheckbox.vue';
import BoDialog from './BoDialog.vue';
import BoIcon from './BoIcon.vue';
import BoInfo from './BoInfo.vue';
import BoPagination from './BoPagination.vue';
import BoTabs from './BoTabs.vue';
import BoDrawer from './drawers/BoDrawer.vue';
import NotificationItem, { type LocalNotification } from './NotificationItem.vue';
import SearchInput from './SearchInput.vue';

const { t, n } = useI18n();
const appStore = useAppStore();
const userStore = useUserStore();
const collectionsStore = useCollectionsStore();
const notificationsStore = useNotificationsStore();
const router = useRouter();

const collection = ref<string | null>(null);
const selection = ref<(string | number)[]>([]);
const confirmDelete = ref(false);
const tab = ref('inbox');
const openNotifications = ref<(string | number)[]>([]);
const page = ref(1);
const limit = ref(25);
const search = ref<string | null>(null);
const filter = ref<Filter | null>(null);
const { notificationsDrawerOpen } = storeToRefs(appStore);
const wide = useMediaQuery('(min-width: 1024px)');

watch(tab, () => (selection.value = []));

// Load notifications only once the drawer is opened and reset when closed (immediate: mounted while open).
watch(notificationsDrawerOpen, (open) => (collection.value = open ? 'directus_notifications' : null), {
	immediate: true,
});

const filterSystem = computed(
	() =>
		({
			_and: [
				{
					recipient: { _eq: userStore.currentUser && 'id' in userStore.currentUser ? userStore.currentUser.id : null },
				},
				{ status: { _eq: tab.value } },
			],
		}) as Filter,
);

const { items, loading, error, totalPages, totalCount, itemCount, getItems, getItemCount, getTotalCount } = useItems(
	collection,
	{
		filter: computed(() => mergeFilters(filter.value, filterSystem.value)),
		filterSystem,
		fields: ref(['id', 'subject', 'message', 'collection', 'item', 'timestamp']),
		sort: ref(['-timestamp']),
		search,
		limit,
		page,
	},
);

watch(error, (err) => err && showUnexpectedError(err));

const notifications = computed<LocalNotification[]>(() =>
	items.value.map((item) => {
		let to: string | undefined = undefined;

		if (item['collection']) {
			const itemCollection = collectionsStore.getCollection(item['collection']);

			if (itemCollection?.meta?.singleton || !item['item']) {
				to = getCollectionRoute(item['collection']);
			} else {
				to = getItemRoute(item['collection'], item['item']);
			}
		} else if (String(item['item']).startsWith('/')) {
			to = String(item['item']);
		}

		return { ...item, to } as LocalNotification;
	}),
);

const showingCount = computed(() => {
	// Don't show count if there are no items
	if (!totalCount.value || !itemCount.value) return;

	return formatItemsCountPaginated({
		currentItems: itemCount.value,
		currentPage: page.value,
		perPage: limit.value,
		totalItems: totalCount.value,
		isFiltered: !!filter.value,
		i18n: { t, n },
	});
});

const someItemsSelected = computed(
	() => selection.value.length > 0 && selection.value.length < notifications.value.length,
);

const allItemsSelected = computed(
	() => selection.value.length === notifications.value.length && notifications.value.length > 0,
);

async function refresh() {
	await getItems();
	await getTotalCount();
	await getItemCount();
}

function selectAll() {
	selection.value = allItemsSelected.value ? [] : notifications.value.map((notification) => notification.id);
}

function toggle(list: (string | number)[], id: string | number) {
	if (list.includes(id)) list.splice(list.indexOf(id), 1);
	else list.push(id);
}

async function toggleArchive() {
	if (selection.value.length === 0) return;

	try {
		await sdk.request(
			requestEndpoint('/notifications', {
				method: 'PATCH',
				body: { keys: selection.value, data: { status: tab.value === 'inbox' ? 'archived' : 'inbox' } },
			}),
		);

		await refresh();
		await notificationsStore.refreshUnreadCount();

		selection.value = [];
	} catch (err) {
		showUnexpectedError(err);
	}
}

async function deleteSelected() {
	try {
		await sdk.request(requestEndpoint('/notifications', { method: 'DELETE', body: selection.value }));

		await refresh();
		await notificationsStore.refreshUnreadCount();
	} catch (err) {
		showUnexpectedError(err);
	} finally {
		confirmDelete.value = false;
		selection.value = [];
	}
}

function onLinkClick(to: string) {
	router.push(to);

	notificationsDrawerOpen.value = false;
}

function clearFilters() {
	filter.value = null;
	search.value = null;
}

const tabs = computed(() => [
	{ value: 'inbox', label: t('inbox') },
	{ value: 'archived', label: t('archive') },
]);

const ICON_BTN =
	'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoDrawer
		v-model="notificationsDrawerOpen"
		icon="notifications"
		:title="$t('notifications')"
		@cancel="notificationsDrawerOpen = false"
		@apply="toggleArchive"
	>
		<template #actions:prepend>
			<span
				v-if="showingCount"
				class="hidden self-center text-theme-sm whitespace-nowrap text-gray-500 sm:inline dark:text-gray-400"
			>
				{{ showingCount }}
			</span>
		</template>

		<template #actions>
			<SearchInput v-model="search" v-model:filter="filter" collection="directus_notifications" />

			<button
				type="button"
				:class="[ICON_BTN, 'text-error-600 dark:text-error-400']"
				:disabled="selection.length === 0"
				:aria-label="$t('delete_label')"
				:title="$t('delete_label')"
				@click="confirmDelete = true"
			>
				<BoIcon name="delete" />
			</button>

			<button
				type="button"
				:class="ICON_BTN"
				:disabled="selection.length === 0"
				:aria-label="tab === 'inbox' ? $t('archive') : $t('unarchive')"
				:title="tab === 'inbox' ? $t('archive') : $t('unarchive')"
				@click="toggleArchive"
			>
				<BoIcon :name="tab === 'inbox' ? 'archive' : 'move_to_inbox'" />
			</button>
		</template>

		<div data-notifications-drawer>
			<BoTabs v-model="tab" :items="tabs" :label="$t('notifications')" :orientation="wide ? 'vertical' : 'horizontal'">
				<template #trigger="{ item }">
					<BoIcon :name="item.value === 'inbox' ? 'inbox' : 'archive'" size="sm" />
					{{ item.label }}
				</template>

				<template #list-append>
					<RouterLink
						to="/activity"
						class="flex min-h-9 items-center gap-2 rounded-lg border-t border-gray-200 px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400"
						@click="notificationsDrawerOpen = false"
					>
						<BoIcon name="manage_search" size="sm" />
						<span class="flex-1">{{ $t('activity') }}</span>
						<BoIcon name="launch" size="sm" />
					</RouterLink>
				</template>

				<template #content>
					<template v-if="!loading && !itemCount">
						<BoInfo v-if="filter || search" :title="$t('no_results')" icon="search">
							{{ $t('no_results_copy') }}
							<template #append>
								<BoButton @click="clearFilters">{{ $t('clear_filters') }}</BoButton>
							</template>
						</BoInfo>

						<BoInfo v-else icon="notifications" :title="$t('no_notifications')">
							{{ $t('no_notifications_copy') }}
						</BoInfo>
					</template>

					<template v-else>
						<ul v-if="loading" class="flex flex-col gap-2" :aria-busy="true" data-testid="notifications-skeleton">
							<li
								v-for="i in 10"
								:key="i"
								class="h-12 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
							/>
						</ul>

						<template v-else>
							<div class="border-y border-gray-100 py-2 dark:border-gray-800">
								<BoCheckbox
									:label="!allItemsSelected ? $t('select_all') : $t('deselect_all')"
									:model-value="allItemsSelected"
									:indeterminate="someItemsSelected"
									@update:model-value="selectAll"
								/>
							</div>

							<ul class="mb-4">
								<NotificationItem
									v-for="notification in notifications"
									:key="notification.id"
									:notification="notification"
									:selected="selection.includes(notification.id)"
									:open="openNotifications.includes(notification.id)"
									:search="search"
									:dense="totalPages > 1"
									@select="toggle(selection, notification.id)"
									@toggle="toggle(openNotifications, notification.id)"
									@navigate="onLinkClick"
								/>
							</ul>
						</template>

						<BoPagination
							v-if="totalPages > 1"
							v-model="page"
							:total-visible="5"
							:length="totalPages"
							:label="$t('notifications')"
						/>
					</template>
				</template>
			</BoTabs>
		</div>

		<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" @click="deleteSelected">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</BoDrawer>
</template>
