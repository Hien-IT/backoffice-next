// Ported from directus/app/src/utils/validate-item.ts
// Backoffice: `new FailedValidationError(...).extensions` of @directus/validation is the mapped extensions object, so
// the mapping is called directly (joi-to-error-extensions.ts).
import type { ContentVersion, Field, LogicalFilterAND } from '@directus/types';
import { validatePayload } from '@directus/utils';
import { cloneDeep, flatten, isEmpty, isNil } from 'lodash-es';
import { useRelationsStore } from '../../../stores/relations.ts';
import { applyConditions } from './apply-conditions.ts';
import {
	type FailedValidationErrorExtensions,
	joiValidationErrorItemToErrorExtensions,
} from './joi-to-error-extensions.ts';
import { parseFilter } from './parse-filter.ts';

export function validateItem(
	item: Record<string, any>,
	fields: Field[],
	isNew: boolean,
	includeCustomValidations = false,
	currentVersion: Pick<ContentVersion, 'name'> | null = null,
): (FailedValidationErrorExtensions & { hidden: boolean | undefined; group: string | null | undefined })[] {
	const relationsStore = useRelationsStore();
	const validationRules: LogicalFilterAND = { _and: [] };
	const updatedItem = cloneDeep(item);

	const fieldsWithConditions = fields.map((field) => {
		const conditionedField = applyConditions(item, field, currentVersion);

		return conditionedField;
	});

	const requiredFields = fieldsWithConditions.filter((field) => field.meta?.required === true);

	requiredFields.forEach((field) => {
		applyRulesForRequiredFields(field.field, field, isNew);

		const relation = relationsStore.getRelationsForField(field.collection, field.field);
		if (!relation.length) return;

		const isEmptyArray = Array.isArray(updatedItem[field.field]) && isEmpty(updatedItem[field.field]);
		if (isEmptyArray) updatedItem[field.field] = null;
	});

	if (includeCustomValidations) fields.forEach(applyValidationRules);

	const errors = validatePayload(validationRules, updatedItem).map((error) =>
		error.details.map((details) => joiValidationErrorItemToErrorExtensions(details)),
	);

	return flatten(errors).map((error) => {
		const errorField = fields.find((field) => field.field === error.field);
		return { ...error, hidden: errorField?.meta?.hidden, group: errorField?.meta?.group };
	});

	function applyRulesForRequiredFields(fieldKey: string, field: Field, isNew: boolean) {
		if (isNew && isNil(field.schema?.default_value)) {
			validationRules._and.push({
				[fieldKey]: {
					_submitted: true,
				},
			});
		}

		validationRules._and.push({
			[fieldKey]: {
				_nnull: true,
			},
		});
	}

	function applyValidationRules(field: Field) {
		if (isNil(updatedItem[field.field])) return;

		(field.meta?.validation as LogicalFilterAND)?._and?.forEach((validation: any) => {
			validationRules._and.push(parseFilter(validation));
		});
	}
}
