<!-- Ported from directus/app/src/modules/settings/routes/roles/public-item.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-3, FR-053): requests through the SDK (FR-001); the save button with the SaveOptions split
// button (recipe Q-8); the unsaved-changes dialog puts "keep editing" first (D-76). BoForm types `primaryKey` without
// null; null is passed as Directus does (the list-m2m then loads the junction rows with `role _null`). Save and stay
// does not refresh revisions: Directus binds no RevisionsSidebarDetail on this page. Errors open the error dialog (D-66).
import type { Alterations, Field, Item, Policy } from '@directus/types';
import { cloneDeep, isEmpty, isEqual, isObjectLike } from 'lodash-es';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import SaveOptions from '../../../../components/SaveOptions.vue';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useFieldsStore } from '../../../../stores/fields.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import RoleInfoSidebarDetail from './RoleInfoSidebarDetail.vue';

type Access = {
	id: string;
	policy: Policy;
};

const { t } = useI18n();

const router = useRouter();

const fieldsStore = useFieldsStore();
const policiesField = cloneDeep(fieldsStore.getField('directus_roles', 'policies'));

// Add filter in order to correctly display the policies of the public role
policiesField!.meta!.options = {
	...policiesField!.meta!.options,
	// Needed for showing policies of the public role in the field
	junctionFilter: {
		role: { _null: true },
		user: { _null: true },
	},
	// Needed for filtering the policies that can be selected, as the list-m2m field applies the same filter, but with
	// _eq: null, which does not work correctly
	filter: {
		'$FOLLOW(directus_access,policy)': {
			_none: {
				_and: [
					{
						role: {
							_null: true,
						},
					},
					{
						user: { _null: true },
					},
				],
			},
		},
	},
};

const fields = [
	{
		field: 'notice',
		type: 'alias',
		meta: {
			system: true,
			interface: 'presentation-notice',
			options: {
				text: t('public_role_info'),
			},
			width: 'full',
			sort: 0,
		},
	},
	policiesField,
] as Field[];

const loading = ref(false);
const saving = ref(false);
const initialValue = ref<{ policies: string[] | null }>({ policies: null });
const edits = ref<{ policies?: Alterations<Access> | null }>({});

const hasEdits = computed(() => !isEmpty(edits.value) && !isEqual(initialValue.value, edits.value));

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

useShortcut('meta+s', () => {
	if (hasEdits.value) saveAndStay();
});

useShortcut('meta+shift+s', () => {
	if (hasEdits.value) saveAndAddNew();
});

onMounted(() => {
	fetchPolicies();
});

async function fetchPolicies() {
	loading.value = true;

	try {
		const response = await sdk.request<{ id: string }[]>(
			requestEndpoint('/access', {
				params: {
					filter: {
						_and: [{ role: { _null: true } }, { user: { _null: true } }],
					},
					fields: ['id'],
					limit: -1,
				},
			}),
		);

		initialValue.value = {
			policies: response.map(({ id }) => id),
		};
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		loading.value = false;
	}
}

async function save() {
	saving.value = true;

	try {
		if (isAlterations(edits.value.policies)) {
			const { create, update, delete: deleted } = edits.value.policies;
			const requests = [];

			if (create && create.length > 0) {
				requests.push(sdk.request(requestEndpoint('/access', { method: 'POST', body: create })));
			}

			if (update && update.length > 0) {
				requests.push(sdk.request(requestEndpoint('/access', { method: 'PATCH', body: update })));
			}

			if (deleted && deleted.length > 0) {
				requests.push(sdk.request(requestEndpoint('/access', { method: 'DELETE', body: deleted })));
			}

			await Promise.all(requests);
		}

		edits.value = {};
		await fetchPolicies();
	} catch (error) {
		showUnexpectedError(error);
		throw error;
	} finally {
		saving.value = false;
	}
}

async function saveAndStay() {
	try {
		await save();
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function saveAndAddNew() {
	try {
		await save();
		router.push({ name: 'settings-add-new-role' });
	} catch {
		// `save` shows unexpected error dialog
	}
}

async function saveAndQuit() {
	try {
		await save();
		router.push({ name: 'settings-roles-collection' });
	} catch {
		// `save` shows unexpected error dialog
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

function isAlterations<T extends Item>(value: any): value is Alterations<T> {
	return isObjectLike(value) && 'create' in value && 'update' in value && 'delete' in value;
}
</script>

<template>
	<PrivateView
		:title="$t('public_label')"
		back="/settings/roles"
		:breadcrumb="[{ name: $t('settings_roles'), to: '/settings/roles' }]"
	>
		<template #actions>
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
				:initial-values="initialValue"
				:fields="fields"
				:primary-key="null as never"
				:loading="loading"
			/>
		</div>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>

		<template #sidebar>
			<RoleInfoSidebarDetail :role="null" />
		</template>
	</PrivateView>
</template>
