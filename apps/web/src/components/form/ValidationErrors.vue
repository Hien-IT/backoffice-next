<!-- Ported from directus/app/src/components/v-form/components/validation-errors.vue -->
<script setup lang="ts">
// Backoffice: ValidationErrors notice recipe (BoNotice danger, field names as buttons that scroll to the field);
// v-detail of the nested validation rows is a toggle button with aria-expanded.
import type { Field, ValidationError } from '@directus/types';
import { computed, ref, toRef } from 'vue';
import BoIcon from '../BoIcon.vue';
import BoNotice from '../BoNotice.vue';
import {
	useValidationErrorDetails,
	type ValidationErrorWithDetails,
} from './composables/use-validation-error-details.ts';
import {
	errorMatchesValidationRule,
	getReferencedFields,
	hasNestedGroups,
	parseValidationStructure,
} from './utils/format-validation-structure.ts';
import ValidationNestedGroups from './ValidationNestedGroups.vue';

const props = defineProps<{
	validationErrors: ValidationError[];
	fields: Field[];
}>();

defineEmits(['scroll-to-field']);

const { validationErrorsWithDetails, getDefaultValidationMessage } = useValidationErrorDetails(
	toRef(() => props.validationErrors),
	toRef(() => props.fields),
);

function getNestedKey(validationError: ValidationErrorWithDetails) {
	return `${validationError.group ?? ''}::${validationError.field}`;
}

const displayValidationErrors = computed(() => {
	const seen = new Set<string>();

	const referencedFieldsMap = new Map<string, Set<string>>();

	props.fields.forEach((field) => {
		if (field.meta?.validation) {
			const referencedFields = getReferencedFields(field.meta.validation);

			referencedFields.forEach((referencedField) => {
				if (!referencedFieldsMap.has(referencedField)) {
					referencedFieldsMap.set(referencedField, new Set());
				}

				referencedFieldsMap.get(referencedField)!.add(field.field);
			});
		}
	});

	const fieldsWithNestedValidation = new Set(
		props.fields
			.filter((field) => field.meta?.validation && hasNestedGroups(field.meta.validation))
			.map((field) => field.field),
	);

	const fieldsWithNestedValidationErrors = new Set(
		validationErrorsWithDetails.value
			.filter((error) => error.hasNestedValidation && error.validationStructure)
			.map((error) => error.field),
	);

	const filteredErrors = validationErrorsWithDetails.value.filter((error) => {
		if (!error.hasNestedValidation || !error.validationStructure) {
			const errorField = props.fields.find((f) => f.field === error.field);

			if (errorField?.meta?.validation) {
				const matchesOwnValidation = errorMatchesValidationRule(
					{
						field: error.field,
						type: error.type,
						substring: error.substring,
						valid: error.valid,
						invalid: error.invalid,
					} as Parameters<typeof errorMatchesValidationRule>[0],
					errorField.meta.validation,
				);

				if (matchesOwnValidation) {
					return true;
				}
			}

			const referencingFields = referencedFieldsMap.get(error.field);

			if (referencingFields) {
				const shouldFilter = Array.from(referencingFields).some((referencingField) => {
					if (
						!fieldsWithNestedValidation.has(referencingField) &&
						!fieldsWithNestedValidationErrors.has(referencingField)
					) {
						return false;
					}

					const referencingFieldObj = props.fields.find((f) => f.field === referencingField);

					if (!referencingFieldObj?.meta?.validation) return false;

					return errorMatchesValidationRule(
						{
							field: error.field,
							type: error.type,
							substring: error.substring,
							valid: error.valid,
							invalid: error.invalid,
						} as Parameters<typeof errorMatchesValidationRule>[0],
						referencingFieldObj.meta.validation,
					);
				});

				if (shouldFilter) {
					return false;
				}
			}

			return true;
		}

		const key = getNestedKey(error);

		if (seen.has(key)) return false;

		seen.add(key);
		return true;
	});

	const allFieldsWithErrors = new Set(validationErrorsWithDetails.value.map((error) => error.field));
	const fieldsWithErrors = new Set(filteredErrors.map((error) => error.field));

	const virtualErrors: ValidationErrorWithDetails[] = [];

	props.fields.forEach((field) => {
		if (
			field.meta?.validation &&
			hasNestedGroups(field.meta.validation) &&
			!fieldsWithErrors.has(field.field) &&
			!fieldsWithNestedValidationErrors.has(field.field)
		) {
			const referencedFields = getReferencedFields(field.meta.validation);

			const matchingErrors = validationErrorsWithDetails.value.filter((error) => {
				if (!allFieldsWithErrors.has(error.field)) return false;
				if (!referencedFields.has(error.field)) return false;

				return errorMatchesValidationRule(
					{
						field: error.field,
						type: error.type,
						substring: error.substring,
						valid: error.valid,
						invalid: error.invalid,
					} as Parameters<typeof errorMatchesValidationRule>[0],
					field.meta?.validation,
				);
			});

			if (matchingErrors.length > 0) {
				const validationStructure = parseValidationStructure(field.meta.validation);

				if (validationStructure) {
					const fieldForError = props.fields.find((f) => f.field === field.field);

					const groupField = fieldForError?.meta?.group
						? props.fields.find((f) => f.field === fieldForError?.meta?.group)
						: null;

					virtualErrors.push({
						code: 'FAILED_VALIDATION',
						collection: fieldForError?.collection ?? '',
						field: field.field,
						type: 'nnull',
						hidden: fieldForError?.meta?.hidden,
						group: fieldForError?.meta?.group ?? null,
						fieldName: fieldForError?.name ?? field.field,
						groupName: groupField?.name ?? fieldForError?.meta?.group,
						customValidationMessage: fieldForError?.meta?.validation_message ?? null,
						validationStructure,
						hasNestedValidation: true,
					} as ValidationErrorWithDetails);
				}
			}
		}
	});

	return [...filteredErrors, ...virtualErrors];
});

function getErrorKey(validationError: ValidationErrorWithDetails) {
	if (validationError.hasNestedValidation && validationError.validationStructure) return getNestedKey(validationError);
	return `${getNestedKey(validationError)}::${validationError.type}`;
}

// Backoffice: v-detail `start-open` state of the nested rows.
const collapsed = ref(new Set<string>());

function toggle(key: string) {
	if (collapsed.value.has(key)) collapsed.value.delete(key);
	else collapsed.value.add(key);
}

const FIELD_BUTTON =
	'rounded font-medium text-gray-800 underline underline-offset-2 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-white/90 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoNotice type="danger" class="col-span-full">
		<p class="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">{{ $t('validation_errors_notice') }}</p>
		<ul class="mt-2 list-disc space-y-1 ps-5 text-sm">
			<li
				v-for="validationError of displayValidationErrors"
				:key="getErrorKey(validationError)"
				class="validation-error"
			>
				<template v-if="validationError.hasNestedValidation && validationError.validationStructure">
					<div class="flex min-w-0 items-center gap-1.5">
						<button
							type="button"
							:class="FIELD_BUTTON"
							@click="$emit('scroll-to-field', validationError.group || validationError.field)"
						>
							<template v-if="validationError.field && validationError.hidden && validationError.group">
								{{
									`${validationError.fieldName} (${$t('hidden_in_group', {
										group: validationError.groupName,
									})}): `
								}}
							</template>
							<template v-else-if="validationError.field && validationError.hidden">
								{{ `${validationError.fieldName} (${$t('hidden')}): ` }}
							</template>
							<template v-else-if="validationError.field">{{ `${validationError.fieldName}: ` }}</template>
						</button>
						<span class="min-w-0 break-words text-gray-500 dark:text-gray-400">
							{{ validationError.customValidationMessage ?? $t('validation_value_is_invalid') }}
						</span>
						<button
							type="button"
							class="inline-flex shrink-0 rounded text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:focus-visible:outline-brand-400"
							:aria-label="$t('toggle')"
							:aria-expanded="!collapsed.has(getErrorKey(validationError))"
							@click.stop="toggle(getErrorKey(validationError))"
						>
							<BoIcon
								name="expand_circle_down"
								size="sm"
								class="transition-transform motion-reduce:transition-none"
								:class="{ '-rotate-90': collapsed.has(getErrorKey(validationError)) }"
							/>
						</button>
					</div>

					<ValidationNestedGroups
						v-show="!collapsed.has(getErrorKey(validationError))"
						:node="validationError.validationStructure"
						:parent-field="validationError.field"
						:fields="props.fields"
					/>
				</template>

				<template v-else>
					<button
						type="button"
						:class="FIELD_BUTTON"
						@click="$emit('scroll-to-field', validationError.group || validationError.field)"
					>
						<template v-if="validationError.field && validationError.hidden && validationError.group">
							{{
								`${validationError.fieldName} (${$t('hidden_in_group', {
									group: validationError.groupName,
								})}): `
							}}
						</template>
						<template v-else-if="validationError.field && validationError.hidden">
							{{ `${validationError.fieldName} (${$t('hidden')}): ` }}
						</template>
						<template v-else-if="validationError.field">{{ validationError.fieldName }}</template>
					</button>
					<span v-if="validationError.field && !validationError.hidden">{{ `: ` }}</span>

					<span class="text-gray-500 dark:text-gray-400">
						<template v-if="validationError.customValidationMessage">
							{{ validationError.customValidationMessage }}
						</template>

						<template v-else>{{ getDefaultValidationMessage(validationError) }}</template>
					</span>
				</template>
			</li>
		</ul>
	</BoNotice>
</template>
