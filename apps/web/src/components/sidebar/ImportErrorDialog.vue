<!-- Ported from directus/app/src/views/private/components/import-error-dialog.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-12 (import error dialog: Modal with an error Alert summary and a list of
// `import_data_error_row` lines, `max-h-80 overflow-auto`); v-dialog + v-card = BoDialog with the title, VNotice =
// BoNotice danger; the help icon tooltip is BoTooltip on a focusable icon. ImportRowLines / ImportRowRange of
// @directus/validation (not a dependency of apps/web) are declared here; APIError is the API error list item.
import type { ValidationError } from '@directus/types';
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { VALIDATION_TYPES } from '../../constants.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoIcon from '../BoIcon.vue';
import BoNotice from '../BoNotice.vue';
import BoTooltip from '../BoTooltip.vue';
import { useValidationErrorDetails } from '../form/composables/use-validation-error-details.ts';

type ImportRowLines = { type: 'lines'; rows: number[] };
type ImportRowRange = { type: 'range'; start: number; end: number };
type APIError = { message?: string; extensions?: Record<string, any> };

interface Props {
	errors: APIError[];
	collection: string;
}

type ValidationErrorWithRows = ValidationError & {
	rows: ImportRowLines[] | ImportRowRange[];
};

const props = defineProps<Props>();

const fieldsStore = useFieldsStore();

const modelValue = defineModel<boolean>({ required: true });

const { t } = useI18n();

const validationErrors = computed<ValidationError[]>(() =>
	props.errors.map(
		(err: APIError) =>
			({
				...err.extensions,
				collection: props.collection,
			}) as ValidationError,
	),
);

const validationTypesErrors = computed<ValidationError[]>(() =>
	validationErrors.value.filter((err: ValidationError) => VALIDATION_TYPES.includes(err?.code)),
);

const otherErrors = computed<(ValidationError & { fieldName?: string; customValidationMessage?: string })[]>(() =>
	validationErrors.value.filter((err: ValidationError) => !VALIDATION_TYPES.includes(err?.code)),
);

const { validationErrorsWithDetails, getDefaultValidationMessage } = useValidationErrorDetails(
	validationTypesErrors,
	toRef(fieldsStore.getFieldsForCollection(props.collection)),
);

const formattedErrors = computed(() => {
	return [
		...validationErrorsWithDetails.value.map((err) => ({ ...err, message: getDefaultValidationMessage(err) })),
		...otherErrors.value.map((err) => ({ ...err, message: t(`errors.${err.code}`, err) })),
	].map((err) => ({
		...err,
		// Backoffice: `?? []` so an error without `rows` (not an import error) does not throw.
		formattedRows: formatRows((err as any as ValidationErrorWithRows).rows ?? []),
		rowCount: ((err as any as ValidationErrorWithRows).rows ?? []).length,
	}));
});

function formatRows(rows: Array<ImportRowLines | ImportRowRange>): string {
	return rows
		.map((r) => {
			if (r.type === 'lines') return r.rows.join(', ');
			return `${r.start}–${r.end}`;
		})
		.join(', ');
}

function closeDialog() {
	modelValue.value = false;
}
</script>

<template>
	<!-- DR v-dialog is persistent; BoDialog has no such prop, Esc / outside click only dismiss like the button. -->
	<BoDialog v-model:open="modelValue" :title="$t('import_data_errors')">
		<BoNotice type="danger">
			<p>{{ $t('import_data_validation_errors_notice') }}</p>
			<ul class="mt-1 max-h-80 list-disc overflow-auto ps-4.5">
				<li v-for="(error, index) in formattedErrors" :key="index" class="mt-1">
					<strong v-if="error.rowCount > 0">
						{{
							$t('import_data_error_row', {
								rows: error.formattedRows,
								field: error?.fieldName ? ` (${error.fieldName})` : '',
							}) + ' '
						}}
					</strong>

					<template v-if="error.customValidationMessage">
						{{ error.customValidationMessage }}
						<BoTooltip :text="error.message">
							<span
								tabindex="0"
								class="inline-flex align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
								:aria-label="error.message"
							>
								<BoIcon name="help" size="sm" />
							</span>
						</BoTooltip>
					</template>
					<template v-else>
						<span>{{ error.message }}</span>
					</template>
				</li>
			</ul>
		</BoNotice>
		<template #actions>
			<BoButton @click="closeDialog">{{ $t('dismiss') }}</BoButton>
		</template>
	</BoDialog>
</template>
