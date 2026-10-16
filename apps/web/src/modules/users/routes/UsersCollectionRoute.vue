<!-- Ported from directus/app/src/modules/users/routes/collection.vue -->
<script setup lang="ts">
// Backoffice: user story 3 of feature 015 (FR-060 to FR-066). Layouts render from the registry as the Content
// collection screen (014 research R4) and the Files library. Batch errors open the error dialog (showUnexpectedError,
// D-66). After an invite the list reloads, then an in-place notice says that no email is sent (D-83,
// `contact_admin_for_link`).
import type { PrimaryKey } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { computed, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import { logout } from '../../../auth.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoInfo from '../../../components/BoInfo.vue';
import BoNotice from '../../../components/BoNotice.vue';
import SearchInput from '../../../components/SearchInput.vue';
import DrawerBatch from '../../../components/drawers/DrawerBatch.vue';
import ExportSidebarDetail from '../../../components/sidebar/ExportSidebarDetail.vue';
import LayoutSidebarDetail from '../../../components/sidebar/LayoutSidebarDetail.vue';
import { showUnexpectedError } from '../../../composables/use-notices.ts';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import { usePreset } from '../../../composables/use-preset.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { getLayout } from '../../../layouts/index.ts';
import { useLayout } from '../../../layouts/use-layout.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import UsersInvite from '../components/UsersInvite.vue';
import UsersNavigation from '../components/UsersNavigation.vue';
import useNavigation from '../composables/use-navigation.ts';

const props = defineProps<{ role?: string | undefined; status?: string | undefined }>();

const { role } = toRefs(props);

const { t } = useI18n();
const { roles } = useNavigation(role);
const userInviteModalActive = ref(false);
const invitedNotice = ref(false);
const serverStore = useServerStore();
const userStore = useUserStore();

const layoutRef = ref();
const selection = ref<(string | number)[]>([]);

const { layout, layoutOptions, layoutQuery, filter, search, resetPreset } = usePreset(ref('directus_users'));

// Backoffice: the layout config whose component and slots render inside the wrapper (tabular when unknown, the users
// default of the presets store).
const currentLayout = computed(() => getLayout(layout.value) ?? getLayout('tabular'));

const { addNewLink } = useLinks();

const { confirmDelete, deleting, batchDelete, batchEditActive } = useBatch();

const { breadcrumb, title } = useBreadcrumb();

const roleFilter = computed(() => {
	if (props.role) {
		return {
			_and: [
				{
					role: {
						_eq: props.role,
					},
				},
			],
		};
	}

	return null;
});

const statusFilter = computed(() => {
	if (props.status) {
		return {
			_and: [
				{
					status: {
						_eq: props.status,
					},
				},
			],
		};
	}

	return null;
});

const combinedSystemFilter = computed(() => mergeFilters(roleFilter.value, statusFilter.value));

const {
	createAllowed,
	updateAllowed: batchEditAllowed,
	deleteAllowed: batchDeleteAllowed,
} = useCollectionPermissions('directus_users');

const { readAllowed: rolesReadAllowed } = useCollectionPermissions('directus_roles');

const canInviteUsers = computed(() => {
	if (serverStore.auth.disableDefault === true) return false;

	return createAllowed.value && rolesReadAllowed.value;
});

const { layoutWrapper } = useLayout(layout);

onBeforeRouteLeave(() => {
	selection.value = [];
});

onBeforeRouteUpdate(() => {
	selection.value = [];
});

async function refresh() {
	await layoutRef.value?.state?.refresh?.();
}

async function onInvited() {
	await refresh();
	invitedNotice.value = true;
}

function useBatch() {
	const confirmDelete = ref(false);
	const deleting = ref(false);

	const batchEditActive = ref(false);

	const error = ref<unknown>();

	return { batchEditActive, confirmDelete, deleting, batchDelete, error };

	async function batchDelete() {
		if (deleting.value) return;

		deleting.value = true;

		const batchPrimaryKeys = selection.value;

		try {
			await sdk.request(requestEndpoint('/users', { method: 'DELETE', body: batchPrimaryKeys }));

			// Check if the current user was among the deleted users
			const currentUserId = userStore.currentUser && 'id' in userStore.currentUser ? userStore.currentUser.id : null;

			if (
				currentUserId &&
				batchPrimaryKeys.some((key) => {
					return key === currentUserId;
				})
			) {
				await logout();
				return;
			}

			await refresh();

			selection.value = [];
			confirmDelete.value = false;
		} catch (e) {
			error.value = e;
			showUnexpectedError(e);
		} finally {
			deleting.value = false;
		}
	}
}

function useLinks() {
	const addNewLink = computed<string>(() => {
		return props.role ? `/users/roles/${props.role}/+` : '/users/+';
	});

	return { addNewLink };
}

function useBreadcrumb() {
	const breadcrumb = computed(() => {
		if (!props.role) return undefined;

		return [
			{
				name: t('user_directory'),
				to: `/users`,
			},
		];
	});

	const title = computed(() => {
		if (props.status) return t(`${props.status}_users`);
		if (!props.role) return t('all_users');
		return roles.value?.find((role) => role.id === props.role)?.name;
	});

	return { breadcrumb, title };
}

function clearFilters() {
	filter.value = null;
	search.value = null;
}

const createUserVisible = computed(() => canInviteUsers.value && (!props.status || props.status === 'active'));
</script>

<template>
	<component
		:is="layoutWrapper"
		ref="layoutRef"
		v-slot="{ layoutState }"
		v-model:selection="selection"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:filter="mergeFilters(filter, combinedSystemFilter)"
		:filter-user="filter"
		:filter-system="combinedSystemFilter"
		:search="search"
		collection="directus_users"
		:reset-preset="resetPreset"
		:clear-filters="clearFilters"
	>
		<PrivateView fill :title="title" icon="people_alt" :breadcrumb="breadcrumb">
			<template #actions>
				<component :is="currentLayout?.slots.actions" v-if="currentLayout?.slots.actions" v-bind="layoutState" />

				<SearchInput v-model="search" v-model:filter="filter" collection="directus_users" />

				<BoButton
					v-if="selection.length > 0"
					variant="secondary"
					icon="delete"
					class="action-delete hover:bg-error-600 hover:text-white"
					:aria-label="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
					:title="batchDeleteAllowed ? $t('delete_label') : $t('not_allowed')"
					:disabled="batchDeleteAllowed !== true"
					@click="confirmDelete = true"
				/>

				<BoButton
					v-if="selection.length > 0"
					variant="secondary"
					icon="edit"
					:aria-label="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					:title="batchEditAllowed ? $t('edit') : $t('not_allowed')"
					:disabled="batchEditAllowed === false"
					@click="batchEditActive = true"
				/>

				<BoButton
					v-if="canInviteUsers"
					variant="secondary"
					icon="person_add"
					:aria-label="$t('invite_users')"
					:title="$t('invite_users')"
					@click="userInviteModalActive = true"
				/>

				<BoButton
					icon="add"
					v-bind="createAllowed ? { to: addNewLink } : {}"
					:disabled="createAllowed === false"
					:aria-label="createAllowed ? $t('create_item') : $t('not_allowed')"
					:title="createAllowed ? $t('create_item') : $t('not_allowed')"
				/>
			</template>

			<template #navigation>
				<UsersNavigation :current-role="role" />
			</template>

			<div aria-live="polite" class="empty:hidden mb-4">
				<BoNotice v-if="invitedNotice" type="info">{{ $t('contact_admin_for_link') }}</BoNotice>
			</div>

			<UsersInvite
				v-if="canInviteUsers"
				v-model="userInviteModalActive"
				:role="role"
				@update:model-value="refresh"
				@invited="onInvited"
			/>

			<component :is="currentLayout?.component" v-bind="layoutState">
				<template #no-results>
					<BoInfo v-if="!filter && !search" :title="$t('user_count', 0)" icon="people_alt">
						{{ status ? $t('no_status_users_copy', { status }) : $t('no_users_copy') }}

						<template v-if="createUserVisible" #append>
							<BoButton :to="role ? { path: `/users/roles/${role}/+` } : { path: '/users/+' }">
								{{ $t('create_user') }}
							</BoButton>
						</template>
					</BoInfo>

					<BoInfo v-else :title="$t('no_results')" icon="search">
						{{ $t('no_results_copy') }}

						<template #append>
							<BoButton @click="clearFilters">{{ $t('clear_filters') }}</BoButton>
						</template>
					</BoInfo>
				</template>

				<template #no-items>
					<BoInfo v-if="!layoutState.loadingItemCount" :title="$t('user_count', 0)" icon="people_alt">
						{{ status ? $t('no_status_users_copy', { status }) : $t('no_users_copy') }}

						<template v-if="createUserVisible" #append>
							<BoButton :to="role ? { path: `/users/roles/${role}/+` } : { path: '/users/+' }">
								{{ $t('create_user') }}
							</BoButton>
						</template>
					</BoInfo>
				</template>
			</component>

			<BoDialog
				v-if="selection.length > 0"
				v-model:open="confirmDelete"
				:title="$t('batch_delete_confirm', selection.length)"
			>
				<template #actions>
					<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
					<BoButton variant="danger" :loading="deleting" @click="batchDelete">{{ $t('delete_label') }}</BoButton>
				</template>
			</BoDialog>

			<DrawerBatch
				v-model:active="batchEditActive"
				:primary-keys="selection as PrimaryKey[]"
				collection="directus_users"
				@refresh="refresh"
			/>

			<template #sidebar>
				<LayoutSidebarDetail v-model="layout">
					<component :is="currentLayout?.slots.options" v-if="currentLayout?.slots.options" v-bind="layoutState" />
				</LayoutSidebarDetail>
				<component :is="currentLayout?.slots.sidebar" v-if="currentLayout?.slots.sidebar" v-bind="layoutState" />
				<ExportSidebarDetail
					collection="directus_users"
					:layout-query="layoutQuery"
					:filter="mergeFilters(filter, combinedSystemFilter) ?? undefined"
					:search="search ?? undefined"
					@refresh="refresh"
				/>
			</template>
		</PrivateView>
	</component>
</template>
