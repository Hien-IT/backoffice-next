<!-- Ported from directus/app/src/modules/users/routes/item.vue -->
<script setup lang="ts">
// Backoffice: user story 4 of feature 015 (FR-070 to FR-076), replacing the 012 profile page (D-48 lifted). The form is
// BoForm on use-item of 014; no collaboration (D-68), so no collab header, collision modal or collab dialogs, and
// "discard and stay" clears the edits; the unsaved-changes dialog puts "keep editing" first (D-76). The user box is
// recipe Q-18 (same width as the form, role badge by status). The interfaces of the form get `discardAllChanges` and
// `refresh` by inject as in Directus; BoForm provides `values`. Errors open the error dialog (D-66).
import type { Field, PrimaryKey, User } from '@directus/types';
import { computed, provide, ref, toRefs, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { logout } from '../../../auth.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoForm from '../../../components/form/BoForm.vue';
import SaveOptions from '../../../components/SaveOptions.vue';
import CommentsSidebarDetail from '../../../components/sidebar/CommentsSidebarDetail.vue';
import RevisionsSidebarDetail from '../../../components/sidebar/RevisionsSidebarDetail.vue';
import { useCollection } from '../../../composables/use-collection.ts';
import { useEditsGuard } from '../../../composables/use-edits-guard.ts';
import { useItem } from '../../../composables/use-item/index.ts';
import { useShortcut } from '../../../composables/use-shortcut.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import { formColumnClass } from '../../../utils/form-column.ts';
import { getAssetUrl } from '../../../utils/get-asset-url.ts';
import { userName } from '../../../utils/user-name.ts';
import ContentNotFound from '../../content/routes/ContentNotFound.vue';
import UserInfoSidebarDetail from '../components/UserInfoSidebarDetail.vue';
import UsersNavigation from '../components/UsersNavigation.vue';

type UserItem = User & {
	role: (Record<string, any> & { id: string; name?: string }) | null;
	avatar: { id: string; modified_on?: string | null } | null;
};

const props = defineProps<{
	primaryKey: string;
	role?: string | undefined;
}>();

const { t, locale } = useI18n();

const router = useRouter();

const form = useTemplateRef<InstanceType<typeof BoForm>>('form');
const fieldsStore = useFieldsStore();
const collectionsStore = useCollectionsStore();
const userStore = useUserStore();
const serverStore = useServerStore();

const { primaryKey } = toRefs(props);
const { breadcrumb } = useBreadcrumb();

const { info: collectionInfo } = useCollection(ref('directus_users'));

const revisionsSidebarDetail = ref<InstanceType<typeof RevisionsSidebarDetail> | null>(null);

const {
	isNew,
	edits,
	hasEdits,
	item: rawItem,
	permissions,
	saving,
	loading,
	save,
	remove,
	deleting,
	saveAsCopy,
	archive,
	archiving,
	isArchived,
	validationErrors,
	refresh,
} = useItem<User>(ref('directus_users'), primaryKey as unknown as import('vue').Ref<PrimaryKey | null>, null, {
	fields: ['*', 'role.*', 'avatar.id', 'avatar.modified_on'],
});

const item = computed(() => rawItem.value as UserItem | null);

const {
	collectionPermissions: { createAllowed, revisionsAllowed },
	itemPermissions: { updateAllowed, deleteAllowed, saveAllowed, archiveAllowed, fields },
} = permissions;

const user = computed(() => ({ ...item.value, role: item.value?.role?.id }));

if (props.role) {
	edits.value = {
		role: props.role,
		...edits.value,
	};
}

const isSavable = computed(() => saveAllowed.value && hasEdits.value);

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

const confirmDelete = ref(false);
const confirmArchive = ref(false);

// Provide the discard functionality to field interfaces
provide('discardAllChanges', discardAndStay);
provide('refresh', refresh);

const avatarSrc = computed(() => {
	if (!item.value?.avatar) return null;

	return getAssetUrl(item.value.avatar.id, {
		imageKey: 'system-medium-cover',
		cacheBuster: item.value.avatar.modified_on ?? false,
	});
});

const avatarError = ref<Event | null>(null);

const title = computed(() => {
	if (loading.value === true) return t('loading');

	if (isNew.value === false && item.value) {
		return userName(item.value as Record<string, any>);
	}

	return t('adding_user');
});

// These fields will be shown in the sidebar instead
const fieldsDenyList = ['id', 'last_page', 'created_on', 'created_by', 'modified_by', 'modified_on', 'last_access'];

const fieldsFiltered = computed(() => {
	return fields.value
		.filter((field: Field) => !fieldsDenyList.includes(field.field))
		.map((field: Field) => {
			// These fields should only be editable when creating new users or by administrators
			// Backoffice: a readonly copy instead of mutating the shared field object of the store.
			if (!isNew.value && ['provider', 'external_identifier'].includes(field.field) && !userStore.isAdmin) {
				return { ...field, meta: { ...field.meta!, readonly: true } };
			}

			return field;
		});
});

// Backoffice (owner 2026-10-18): the body is centred, the page header keeps the full width (layout-patterns §5).
const formColumn = computed(() => formColumnClass(fieldsFiltered.value));

const archiveTooltip = computed(() => {
	if (archiveAllowed.value === false) return t('not_allowed');
	if (isArchived.value === true) return t('unarchive');
	return t('archive');
});

useShortcut('meta+s', saveAndStay, form as never);
useShortcut('meta+shift+s', saveAndAddNew, form as never);

const currentUserId = computed(() => {
	const current = userStore.currentUser;
	return current && 'id' in current ? current.id : null;
});

function useBreadcrumb() {
	const breadcrumb = computed(() => [
		{
			name: t('user_directory'),
			to: `/users`,
		},
	]);

	return { breadcrumb };
}

async function saveAndQuit() {
	try {
		const savedItem = ((await save()) ?? {}) as Record<string, any>;
		await setLang(savedItem);
		await refreshCurrentUser();
		router.push({ name: 'users-active' });
	} catch {
		// `save` will show unexpected error dialog
	}
}

async function saveAndStay() {
	try {
		const savedItem = ((await save()) ?? {}) as Record<string, any>;
		await setLang(savedItem);
		await refreshCurrentUser();

		if (props.primaryKey === '+') {
			const newPrimaryKey = savedItem['id'];
			router.replace({ name: 'users-item', params: { primaryKey: newPrimaryKey } });
		} else {
			revisionsSidebarDetail.value?.refresh?.();
			refresh();
		}
	} catch {
		// `save` will show unexpected error dialog
	}
}

async function saveAndAddNew() {
	try {
		const savedItem = ((await save()) ?? {}) as Record<string, any>;
		await setLang(savedItem);
		await refreshCurrentUser();
		router.push({ name: 'users-item', params: { primaryKey: '+' } });
	} catch {
		// `save` will show unexpected error dialog
	}
}

async function saveAsCopyAndNavigate() {
	try {
		const newPrimaryKey = await saveAsCopy();
		if (newPrimaryKey) router.push({ name: 'users-item', params: { primaryKey: newPrimaryKey } });
	} catch {
		// `save` will show unexpected error dialog
	}
}

async function deleteAndQuit() {
	if (deleting.value) return;

	try {
		// If the deleted user is the current user, we want to log them out
		if (currentUserId.value && currentUserId.value === item.value?.id) {
			await remove();
			await logout();
			return;
		}

		await remove();
		edits.value = {};
		router.replace({ name: 'users-active' });
	} catch {
		// `remove` will show the unexpected error dialog
	}
}

async function setLang(saved: Record<string, any>) {
	if (currentUserId.value !== item.value?.id) return;

	const newLang = saved?.['language'] ?? serverStore.info?.project?.default_language;

	if (newLang && newLang !== locale.value) {
		await Promise.all([fieldsStore.hydrate(), collectionsStore.hydrate()]);
	}
}

async function refreshCurrentUser() {
	// Backoffice: the 012 language watcher of the user store applies a changed language after this hydrate (CHK039).
	if (currentUserId.value === item.value?.id) {
		await userStore.hydrate();
	}
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

function discardAndStay() {
	// Backoffice: no collaboration session to discard (D-68): the edits go back to the saved item.
	edits.value = {};
	confirmLeave.value = false;
}

async function toggleArchive() {
	if (archiving.value) return;

	await archive();

	if (isArchived.value === true) {
		router.push({ name: 'users-active' });
	} else {
		confirmArchive.value = false;
	}
}

function revert(values: Record<string, any>) {
	edits.value = {
		...edits.value,
		...values,
	};
}

// Recipe Q-18: the role badge (Badge light) by status.
const STATUS_BADGE: Record<string, string> = {
	active: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
	invited: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	suspended: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
	draft: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
	archived: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
};

const notFound = computed(() => !isNew.value && !loading.value && !item.value);
</script>

<template>
	<ContentNotFound v-if="notFound" module="users" />
	<PrivateView v-else :title="title" back="/users" :breadcrumb="breadcrumb">
		<template #actions>
			<BoButton
				variant="secondary"
				icon="delete"
				class="action-delete hover:bg-error-600 hover:text-white"
				:aria-label="deleteAllowed ? $t('delete_label') : $t('not_allowed')"
				:title="deleteAllowed ? $t('delete_label') : $t('not_allowed')"
				:disabled="item === null || deleteAllowed !== true"
				@click="confirmDelete = true"
			/>

			<BoButton
				v-if="collectionInfo?.meta && collectionInfo.meta.archive_field && !isNew && collectionInfo.meta.singleton === false"
				variant="secondary"
				:icon="isArchived ? 'unarchive' : 'archive'"
				:aria-label="archiveTooltip"
				:title="archiveTooltip"
				:disabled="item === null || archiveAllowed !== true"
				@click="confirmArchive = true"
			/>

			<div class="flex items-center">
				<BoButton
					icon="check"
					:class="isSavable ? 'rounded-e-none' : ''"
					:aria-label="saveAllowed ? $t('save') : $t('not_allowed')"
					:title="saveAllowed ? $t('save') : $t('not_allowed')"
					:loading="saving"
					:disabled="!isSavable"
					@click="saveAndQuit"
				/>
				<SaveOptions
					v-if="isSavable"
					:disabled-options="createAllowed ? [] : ['save-and-add-new', 'save-as-copy']"
					@save-and-stay="saveAndStay"
					@save-and-add-new="saveAndAddNew"
					@save-as-copy="saveAsCopyAndNavigate"
					@discard-and-stay="discardAndStay"
				/>
			</div>
		</template>

		<template #navigation>
			<UsersNavigation :current-role="item?.role?.id ?? role" />
		</template>

		<div class="user-item flex flex-col gap-8" :class="formColumn">
			<div
				v-if="isNew === false"
				class="user-box flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
			>
				<div class="avatar shrink-0">
					<div
						v-if="loading"
						class="size-20 animate-pulse rounded-full bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
						aria-hidden="true"
					/>
					<img
						v-else-if="avatarSrc && !avatarError"
						:src="avatarSrc"
						:alt="$t('avatar')"
						class="size-20 rounded-full object-cover"
						@error="avatarError = $event"
					/>
					<BoIcon v-else name="account_circle" class="text-gray-500 dark:text-gray-400 [font-size:5rem]!" aria-hidden="true" />
				</div>
				<!-- long names/emails are clipped, the name on one line: users/routes/item.vue:582, 615 -->
				<div class="user-box-content flex min-w-0 grow flex-col gap-1 overflow-hidden">
					<template v-if="loading">
						<div
							v-for="n in 3"
							:key="n"
							class="h-4 w-48 animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
							aria-hidden="true"
						/>
					</template>
					<template v-else-if="isNew === false && item">
						<p class="name m-0 truncate text-lg font-semibold text-gray-800 dark:text-white/90">
							{{ userName(item as Record<string, any>) }}
							<span v-if="item.title" class="title font-normal text-gray-500 dark:text-gray-400">, {{ item.title }}</span>
						</p>
						<p v-if="item.email" class="email m-0 flex items-center gap-1 text-theme-sm text-gray-500 dark:text-gray-400">
							<BoIcon name="alternate_email" size="sm" aria-hidden="true" />
							{{ item.email }}
						</p>
						<p
							v-if="item.location"
							class="location m-0 flex items-center gap-1 text-theme-sm text-gray-500 dark:text-gray-400"
						>
							<BoIcon name="place" size="sm" aria-hidden="true" />
							{{ item.location }}
						</p>
						<span
							v-if="item.role?.name"
							class="role-badge mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-theme-xs font-medium"
							:class="[item.status, STATUS_BADGE[item.status] ?? STATUS_BADGE['draft']]"
						>
							{{ item.role.name }}
							<span class="sr-only">({{ $t(`fields.directus_users.status_${item.status}`) }})</span>
						</span>
					</template>
				</div>
			</div>

			<BoForm
				ref="form"
				v-model="edits"
				card
				:disabled="isNew ? false : updateAllowed === false"
				:fields="fieldsFiltered"
				:loading="loading"
				:initial-values="user"
				:primary-key="primaryKey"
				:validation-errors="validationErrors"
			/>
		</div>

		<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteAndQuit">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmArchive" :title="isArchived ? $t('unarchive_confirm') : $t('archive_confirm')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmArchive = false">{{ $t('cancel') }}</BoButton>
				<BoButton :loading="archiving" @click="toggleArchive">
					{{ isArchived ? $t('unarchive') : $t('archive') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>

		<template #sidebar>
			<UserInfoSidebarDetail :is-new="isNew" :user="item" />
			<RevisionsSidebarDetail
				v-if="isNew === false && revisionsAllowed"
				ref="revisionsSidebarDetail"
				collection="directus_users"
				:primary-key="primaryKey"
				@revert="revert"
			/>
			<CommentsSidebarDetail v-if="isNew === false" collection="directus_users" :primary-key="primaryKey" />
		</template>
	</PrivateView>
</template>
