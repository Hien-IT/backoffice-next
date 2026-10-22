<!-- Ported from directus/app/src/modules/settings/routes/roles/item.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-2, FR-052): the header actions are BoButtons (delete, invite, save with the SaveOptions
// split button of recipe Q-8) and the confirmations BoDialogs; the unsaved-changes dialog puts "keep editing" first
// (D-76). The form is BoForm on use-item of 014. UsersInvite is the 015 dialog (D-83). Errors open the error dialog
// (D-66).
import type { PrimaryKey, Role } from '@directus/types';
import { computed, ref, toRefs, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import SaveOptions from '../../../../components/SaveOptions.vue';
import RevisionsSidebarDetail from '../../../../components/sidebar/RevisionsSidebarDetail.vue';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { useItem } from '../../../../composables/use-item/index.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useServerStore } from '../../../../stores/server.ts';
import { useUserStore } from '../../../../stores/user.ts';
import UsersInvite from '../../../users/components/UsersInvite.vue';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import RoleInfoSidebarDetail from './RoleInfoSidebarDetail.vue';

const props = defineProps<{
	primaryKey: string;
	permissionKey?: string;
}>();

const router = useRouter();

const userStore = useUserStore();
const serverStore = useServerStore();
const userInviteModalActive = ref(false);
const { primaryKey } = toRefs(props);

const revisionsSidebarDetailRef = ref<InstanceType<typeof RevisionsSidebarDetail> | null>(null);

const { edits, hasEdits, item, saving, loading, save, remove, deleting, validationErrors } = useItem<Role>(
	ref('directus_roles'),
	primaryKey as unknown as Ref<PrimaryKey | null>,
	null,
	{ deep: { users: { _limit: 0 } } },
);

const canInviteUsers = computed(() => !serverStore.auth.disableDefault);

const confirmDelete = ref(false);

useShortcut('meta+s', () => {
	if (hasEdits.value) saveAndStay();
});

useShortcut('meta+shift+s', () => {
	if (hasEdits.value) saveAndAddNew();
});

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

/**
 * @NOTE
 * The userStore contains the information about the role of the current user. We want to
 * update the userStore to make sure the role information is accurate with the latest changes
 * in case we're changing the current user's role
 */

async function saveAndStay() {
	try {
		await save();
		await userStore.hydrate();
		revisionsSidebarDetailRef.value?.refresh?.();
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function saveAndAddNew() {
	try {
		await save();
		await userStore.hydrate();
		router.push({ name: 'settings-add-new-role' });
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function saveAndQuit() {
	try {
		await save();
		await userStore.hydrate();
		router.push({ name: 'settings-roles-collection' });
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function deleteAndQuit() {
	if (deleting.value) return;

	try {
		await remove();
		edits.value = {};
		router.replace({ name: 'settings-roles-collection' });
	} catch {
		// `remove` shows unexpected error dialog
	}
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

function discardAndStay() {
	edits.value = {};
	confirmLeave.value = false;
}
</script>

<template>
	<PrivateView
		:title="loading ? $t('loading') : $t('editing_role', { role: item && item.name })"
		back="/settings/roles"
		:breadcrumb="[{ name: $t('settings_roles'), to: '/settings/roles' }]"
	>
		<template #actions>
			<BoButton
				variant="secondary"
				icon="delete"
				class="action-delete hover:bg-error-600 hover:text-white"
				:aria-label="$t('delete_label')"
				:title="$t('delete_label')"
				:disabled="item === null"
				@click="confirmDelete = true"
			/>

			<BoButton
				v-if="canInviteUsers"
				variant="secondary"
				icon="person_add"
				:aria-label="$t('invite_users')"
				:title="$t('invite_users')"
				@click="userInviteModalActive = true"
			/>

			<div class="flex items-center">
				<BoButton
					icon="check"
					:class="hasEdits ? 'rounded-e-none' : ''"
					:aria-label="$t('save')"
					:title="$t('save')"
					:loading="saving"
					:disabled="!hasEdits"
					@click="saveAndQuit"
				/>
				<SaveOptions
					v-if="hasEdits"
					:disabled-options="['save-as-copy']"
					@save-and-stay="saveAndStay"
					@save-and-add-new="saveAndAddNew"
					@discard-and-stay="discardAndStay"
				/>
			</div>
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<UsersInvite v-model="userInviteModalActive" :role="primaryKey" />

		<div class="content max-w-5xl">
			<BoForm
				v-model="edits"
				card
				collection="directus_roles"
				:primary-key="primaryKey"
				:loading="loading"
				:initial-values="item"
				:validation-errors="validationErrors"
			/>
		</div>

		<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteAndQuit">{{ $t('delete_label') }}</BoButton>
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
			<RoleInfoSidebarDetail :role="item" />
			<RevisionsSidebarDetail ref="revisionsSidebarDetailRef" collection="directus_roles" :primary-key="primaryKey" />
		</template>
	</PrivateView>
</template>
