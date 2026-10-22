<!-- Ported from directus/app/src/modules/settings/routes/policies/item.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-5, FR-055): the header actions are BoButtons (delete, save with the SaveOptions split
// button of recipe Q-8) and the confirmations BoDialogs; the unsaved-changes dialog puts "keep editing" first (D-76).
// The form is BoForm on use-item of 014; its `permissions` field renders `system-permissions` from the field meta.
// Errors open the error dialog (D-66).
import type { Policy, PrimaryKey } from '@directus/types';
import { ref, toRefs, type Ref } from 'vue';
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
import { useUserStore } from '../../../../stores/user.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import PolicyInfoSidebarDetail from './PolicyInfoSidebarDetail.vue';

const props = defineProps<{
	primaryKey: string;
	permissionKey?: string;
}>();

const router = useRouter();

const userStore = useUserStore();
const { primaryKey } = toRefs(props);

const revisionsSidebarDetailRef = ref<InstanceType<typeof RevisionsSidebarDetail> | null>(null);

const { edits, hasEdits, item, saving, loading, save, remove, deleting, validationErrors } = useItem<Policy>(
	ref('directus_policies'),
	primaryKey as unknown as Ref<PrimaryKey | null>,
);

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
		revisionsSidebarDetailRef.value?.refresh?.();
		await userStore.hydrate();
	} catch {
		// 'save' shows unexpected error dialog
	}
}

async function saveAndAddNew() {
	try {
		await save();
		await userStore.hydrate();
		router.push({ name: 'settings-add-new-policy' });
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function saveAndQuit() {
	try {
		await save();
		await userStore.hydrate();
		router.push({ name: 'settings-policies-collection' });
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function deleteAndQuit() {
	if (deleting.value) return;

	try {
		await remove();
		edits.value = {};
		router.replace({ name: 'settings-policies-collection' });
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
		:title="loading ? $t('loading') : $t('editing_policy', { policy: item && item.name })"
		back="/settings/policies"
		:breadcrumb="[{ name: $t('settings_permissions'), to: '/settings/policies' }]"
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

		<div class="content flex max-w-5xl flex-col gap-6">
			<BoForm
				v-model="edits"
				card
				collection="directus_policies"
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
			<PolicyInfoSidebarDetail :policy="item" />
			<RevisionsSidebarDetail
				ref="revisionsSidebarDetailRef"
				collection="directus_policies"
				:primary-key="primaryKey"
			/>
		</template>
	</PrivateView>
</template>
