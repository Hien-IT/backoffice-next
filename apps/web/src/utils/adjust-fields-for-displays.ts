// Ported from directus/app/src/utils/adjust-fields-for-displays.ts
import type { Field } from '@directus/types';
import { getDisplay } from '../displays/index.ts';
import { useFieldsStore } from '../stores/fields.ts';

export function adjustFieldsForDisplays(fields: readonly string[], parentCollection: string): string[] {
	const fieldsStore = useFieldsStore();

	const adjustedFields: string[] = fields
		.map((fieldKey) => {
			const field: Field | null = fieldsStore.getField(parentCollection, fieldKey);

			if (!field) return fieldKey;
			if (field.meta?.display === null) return fieldKey;

			// Backoffice: the display config comes from the registry (research R2) instead of useExtension.
			const display = getDisplay(field.meta?.display ?? null);

			if (!display) return fieldKey;
			if (!display.fields) return fieldKey;

			let fieldKeys: string[] | null = null;

			if (Array.isArray(display.fields)) {
				fieldKeys = display.fields.map((relatedFieldKey: string) => `${fieldKey}.${relatedFieldKey}`);
			}

			if (typeof display.fields === 'function') {
				fieldKeys = display
					.fields(field.meta?.display_options, {
						collection: field.collection,
						field: field.field,
						type: field.type,
					})
					.map((relatedFieldKey: string) => `${fieldKey}.${relatedFieldKey}`);
			}

			if (fieldKeys) {
				return fieldKeys.map((fieldKey) => {
					/**
					 * This is for the special case where you want to show a thumbnail in a relation to
					 * directus_files. The thumbnail itself isn't a real field, but shows the thumbnail based
					 * on the other available fields (like ID, title, and type).
					 */
					if (fieldKey.includes('$thumbnail') && field.collection === 'directus_files') {
						return fieldKey
							.split('.')
							.filter((part) => part !== '$thumbnail')
							.join('.');
					}

					return fieldKey;
				});
			}

			return fieldKey;
		})
		.flat();

	return adjustedFields;
}
