<!-- Ported from directus/app/src/views/private/components/flow-dialogs.vue -->
<script setup lang="ts">
// Backoffice: Modal recipe (BoDialog: Esc, outside click and focus return come from Reka); Enter does not confirm
// (Directus `@apply`), the confirm button does. The result of the run is shown as a BoNotice under the dialogs
// because there is no snackbar before feature 018 (D-45). Shared by `header` and `presentation-links`.
import type { Field } from '@directus/types';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoForm from '../../components/form/BoForm.vue';
import type { FlowDialogsContext } from '../../composables/use-run-manual-flow.ts';

defineProps<FlowDialogsContext>();
</script>

<template>
	<BoDialog
		:open="displayUnsavedChangesDialog"
		:title="$t('unsaved_changes')"
		:description="$t('run_flow_on_current_edited_confirm')"
		@update:open="(open) => !open && resetConfirm()"
	>
		<template #actions>
			<BoButton variant="secondary" @click="resetConfirm">{{ $t('cancel') }}</BoButton>
			<BoButton @click="confirmUnsavedChanges(currentFlowId!)">{{ confirmButtonCTA }}</BoButton>
		</template>
	</BoDialog>

	<BoDialog
		:open="displayCustomConfirmDialog"
		:title="confirmDialogDetails?.description ?? $t('run_flow_confirm')"
		@update:open="(open) => !open && resetConfirm()"
	>
		<BoForm
			v-if="confirmDialogDetails?.fields.length"
			:fields="confirmDialogDetails.fields as Field[]"
			:model-value="confirmValues"
			autofocus
			primary-key="+"
			@update:model-value="updateFieldValues($event)"
		/>

		<template #actions>
			<BoButton variant="secondary" @click="resetConfirm">{{ $t('cancel') }}</BoButton>
			<BoButton :disabled="isConfirmButtonDisabled" @click="confirmCustomDialog(currentFlowId!)">
				{{ confirmButtonCTA }}
			</BoButton>
		</template>
	</BoDialog>

	<BoNotice v-if="notice" :type="notice.type" class="mt-3">{{ notice.text }}</BoNotice>
</template>
