<!-- Ported from directus/app/src/views/private/components/flow-dialogs.vue -->
<script setup lang="ts">
// Backoffice: Modal recipe (BoDialog: Esc, outside click and focus return come from Reka); Enter does not confirm
// (DR `@apply`), the confirm button does. The result of the run is shown as a BoNotice under the dialogs
// because there is no snackbar before feature 018 (D-45). Shared by `header` and `presentation-links`.
import type { Field } from '@directus/types';
import { defineAsyncComponent } from 'vue';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoNotice from '../../components/BoNotice.vue';
import type { FlowDialogsContext } from '../../composables/use-run-manual-flow.ts';

// Backoffice: lazy, so the interfaces that use these dialogs (through DrawerItem too) can be imported on their own:
// BoForm imports the interface registry, which imports them back (import cycle).
const BoForm = defineAsyncComponent(() => import('../../components/form/BoForm.vue'));

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
