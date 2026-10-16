// Ported from directus/app/src/modules/settings/routes/data-model/utils/field-exists.ts
import { useFieldsStore } from '../../../../../stores/fields.ts';

export function fieldExists(collection: string, field: string) {
	return !!useFieldsStore().getField(collection, field);
}
