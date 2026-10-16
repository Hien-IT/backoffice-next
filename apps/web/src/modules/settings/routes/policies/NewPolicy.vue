<!-- Ported from directus/app/src/modules/settings/routes/policies/add-new.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-5, recipe Q-27): BoDialog with a form, so Enter saves (Directus `apply`); Cancel first; the
// two checkboxes are BoCheckbox rows under their field label. BoInput gives '' when emptied: it is kept as null like
// the nullable v-input, so Save stays disabled. BoDialog has no `persistent` mode: Esc and a click outside both go back
// to the list (Directus: Esc only).
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoCheckbox from '../../../../components/BoCheckbox.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoInput from '../../../../components/BoInput.vue';
import { useDialogRoute } from '../../../../composables/use-dialog-route.ts';
import { useSave } from './use-save.ts';

const router = useRouter();

const isOpen = useDialogRoute();

const name = ref<string | null>(null);
const appAccess = ref(false);
const adminAccess = ref(false);

const { saving, save } = useSave({ name, appAccess, adminAccess });

function close() {
	router.push({ name: 'settings-policies-collection' });
}
</script>

<template>
	<BoDialog :open="isOpen" :title="$t('create_policy')" @update:open="!$event && close()">
		<form id="new-policy-form" class="grid grid-cols-2 gap-x-3 gap-y-5" @submit.prevent="save">
			<div class="col-span-2">
				<BoInput
					:model-value="name"
					autofocus
					:aria-label="$t('policy_name')"
					:placeholder="$t('policy_name') + '...'"
					:maxlength="100"
					@update:model-value="name = $event === '' ? null : $event"
				/>
			</div>

			<fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
				<legend class="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-400">
					{{ $t('fields.directus_policies.app_access') }}
				</legend>
				<BoCheckbox v-model="appAccess" :label="$t('enabled')" />
			</fieldset>

			<fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
				<legend class="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-400">
					{{ $t('fields.directus_policies.admin_access') }}
				</legend>
				<BoCheckbox v-model="adminAccess" :label="$t('enabled')" />
			</fieldset>
		</form>

		<template #actions>
			<BoButton variant="secondary" @click="close">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="new-policy-form" :disabled="name === null" :loading="saving">
				{{ $t('save') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
