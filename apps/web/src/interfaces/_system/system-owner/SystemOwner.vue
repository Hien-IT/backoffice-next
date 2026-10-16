<!-- Ported from directus/app/src/interfaces/_system/system-owner/system-owner.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US5-3, recipe Q-25): a read-only row with the owner email and a named edit icon button; the
// drawer holds the owner fields of the setup form (form.ts: email, usage, organisation when commercial) in BoForm and
// the product updates BoCheckbox. No license notice (D-53). Save goes through settingsStore.setOwner
// (`POST /settings/owner`, no owner report, D-38) and reloads the settings, outside the edits of the settings form.
import { computed, ref } from 'vue';
import BoButton from '../../../components/BoButton.vue';
import BoCheckbox from '../../../components/BoCheckbox.vue';
import BoDrawer from '../../../components/drawers/BoDrawer.vue';
import BoForm from '../../../components/form/BoForm.vue';
import { useSettingsStore } from '../../../stores/settings.ts';
import { type OwnerForm, useFormFields, validate, type ValidationError } from './form.ts';

const settingsStore = useSettingsStore();

const errors = ref<ValidationError[]>([]);
const editing = ref(false);
const isSaving = ref(false);

const form = ref<OwnerForm>({});

const initialValues = computed(
	() =>
		({
			project_owner: settingsStore.settings?.['project_owner'] ?? null,
			project_usage: settingsStore.settings?.['project_usage'] ?? null,
			org_name: settingsStore.settings?.['org_name'] ?? null,
			product_updates: settingsStore.settings?.['product_updates'] ?? null,
		}) as OwnerForm,
);

const fields = useFormFields(form, initialValues);

const isSaveAllowed = computed(
	() =>
		form.value.project_owner ||
		form.value.project_usage ||
		('product_updates' in form.value && form.value.product_updates !== initialValues.value.product_updates),
);

const productUpdates = computed({
	get: () => form.value.product_updates ?? initialValues.value.product_updates ?? false,
	set: (val: boolean) => (form.value = { ...form.value, product_updates: val }),
});

async function save() {
	const value = { ...initialValues.value, ...form.value };

	errors.value = validate(value, fields.value);

	if (errors.value.length > 0) return;

	isSaving.value = true;
	await settingsStore.setOwner(value as never);
	await settingsStore.hydrate();
	reset();
	isSaving.value = false;
}

async function reset() {
	form.value = {};
	editing.value = false;
	errors.value = [];
}
</script>

<template>
	<div
		class="system-owner flex min-h-11 items-center gap-3 rounded-lg border border-gray-300 px-4 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90"
	>
		<span class="min-w-0 flex-1 truncate">{{ form.project_owner ?? initialValues.project_owner }}</span>
		<BoButton
			variant="ghost"
			icon="edit"
			:aria-label="$t('interfaces.system-owner.edit')"
			:title="$t('interfaces.system-owner.edit')"
			@click="editing = true"
		/>
	</div>

	<BoDrawer v-model="editing" :title="$t('interfaces.system-owner.update')" icon="link" @cancel="reset" @apply="save">
		<template #actions>
			<BoButton
				icon="check"
				:aria-label="$t('save')"
				:title="$t('save')"
				:disabled="!isSaveAllowed"
				:loading="isSaving"
				@click="save"
			/>
		</template>

		<div class="drawer-content flex flex-col gap-6 p-6">
			<BoForm
				:model-value="form"
				:initial-values="initialValues"
				:validation-errors="errors as never"
				:show-validation-errors="false"
				:fields="fields"
				disabled-menu
				@update:model-value="form = $event"
			/>
			<BoCheckbox v-model="productUpdates" :label="$t('setup_marketing_emails')" />
		</div>
	</BoDrawer>
</template>
