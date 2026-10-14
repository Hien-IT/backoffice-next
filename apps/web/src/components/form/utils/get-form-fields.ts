// Ported from directus/app/src/components/v-form/utils/get-form-fields.ts
// Backoffice: interfaces come from the registry (getInterface) instead of useExtension; indicatorStyle (comparison
// mode) is left out (D-55).
import type { Field } from '@directus/types';
import { cloneDeep, orderBy } from 'lodash-es';
import { computed, type ComputedRef, type Ref } from 'vue';
import { getInterface } from '../../../interfaces/index.ts';
import { getDefaultInterfaceForType } from '../../../utils/get-default-interface-for-type.ts';
import { translate } from '../../../utils/translate-object-values.ts';
import type { FormField } from '../types.ts';

export function getFormFields(fields: Ref<Field[]>): ComputedRef<Field[]> {
	return computed(() => {
		const systemFields: Field[] = [];
		const userFields: Field[] = [];

		const clonedFields = cloneDeep(fields.value);

		const sortedFields = orderBy(clonedFields, ['meta.group', 'meta.sort', 'meta.id'], ['desc', 'asc', 'asc']);

		for (let field of sortedFields) {
			const systemFake = field.field?.startsWith('$');
			if (systemFake) continue;

			field = translate(field);

			if (!field.meta) {
				userFields.push(field);
				continue;
			}

			let interfaceUsed = field.meta.interface ? (getInterface(field.meta.interface) ?? null) : null;

			if (interfaceUsed === null) {
				field.meta.interface = getDefaultInterfaceForType(field.type);
				interfaceUsed = getInterface(field.meta.interface) ?? null;
			}

			if (interfaceUsed?.hideLabel === true) {
				(field as FormField).hideLabel = true;
			}

			if (interfaceUsed?.hideLoader === true) {
				(field as FormField).hideLoader = true;
			}

			(field.meta.system ? systemFields : userFields).push(field);
		}

		return [
			...systemFields,
			...(systemFields.length > 0 && userFields.length > 0
				? [
						{
							field: '$system_divider',
							type: 'alias',
							meta: { interface: 'presentation-divider', group: null },
							hideLabel: true,
							hideLoader: true,
						} as unknown as Field,
					]
				: []),
			...userFields,
		];
	});
}
