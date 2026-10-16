<!-- Ported from directus/app/src/modules/settings/routes/roles/add-new.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-2, recipe Q-27): BoDialog with a form, so Enter saves (Directus `apply`); Cancel first.
// BoInput gives '' when emptied: it is kept as null like the nullable v-input, so Save stays disabled. BoDialog has no
// `persistent` mode: Esc and a click outside both go back to the list (Directus: Esc only).
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoInput from '../../../../components/BoInput.vue';
import { useDialogRoute } from '../../../../composables/use-dialog-route.ts';
import { useSave } from './use-save.ts';

const router = useRouter();

const isOpen = useDialogRoute();

const name = ref<string | null>(null);

const { saving, save } = useSave({ name });

function close() {
	router.push({ name: 'settings-roles-collection' });
}
</script>

<template>
	<BoDialog :open="isOpen" :title="$t('create_role')" @update:open="!$event && close()">
		<form id="new-role-form" @submit.prevent="save">
			<BoInput
				:model-value="name"
				autofocus
				:aria-label="$t('role_name')"
				:placeholder="$t('role_name') + '...'"
				:maxlength="100"
				@update:model-value="name = $event === '' ? null : $event"
			/>
		</form>

		<template #actions>
			<BoButton variant="secondary" @click="close">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="new-role-form" :disabled="name === null" :loading="saving">
				{{ $t('save') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
