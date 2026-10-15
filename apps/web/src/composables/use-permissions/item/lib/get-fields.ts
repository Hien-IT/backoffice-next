// Ported from directus/app/src/composables/use-permissions/item/lib/get-fields.ts
import { useCollection } from '../../../../composables/use-collection.ts';
import type { Field, ItemPermissions } from '@directus/types';
import { cloneDeep } from 'lodash-es';
import { computed, type MaybeRef, ref, type Ref, unref } from 'vue';
import type { Collection, IsNew } from '../../types/index.ts';
import type { FormField } from '../../../../components/form/types.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useUserStore } from '../../../../stores/user.ts';

export function getFields(
	collection: Collection,
	isNew: IsNew,
	fetchedItemPermissions: Ref<ItemPermissions>,
	isVersion: MaybeRef<boolean> = false,
) {
	const userStore = useUserStore();
	const { getPermission } = usePermissionsStore();
	const { fields: rawFields, info: collectionInfo } = useCollection(ref(collection));

	return computed(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return [];

		let fields = cloneDeep(rawFields.value);

		if (userStore.isAdmin) return fields;

		const readableFields = getPermission(collectionValue, 'read')?.fields;

		// remove fields without read permissions so they don't show up in the DOM
		if (readableFields && !readableFields.includes('*')) {
			fields = fields.filter((field) => readableFields.includes(field.field));
		}

		// Version editing bypasses underlying collection write permissions entirely.
		// Field-level access is enforced by the backend at promote time.
		if (unref(isVersion)) return fields;

		let permission;

		if (collectionInfo.value?.meta?.singleton) {
			permission = fetchedItemPermissions.value.update;
		} else if (unref(isNew)) {
			permission = getPermission(collectionValue, 'create');
		} else {
			const storePermission = getPermission(collectionValue, 'update');

			if (storePermission?.access !== 'partial') {
				permission = storePermission;
			} else if (fetchedItemPermissions.value.update.access) {
				permission = storePermission;
			} else {
				permission = null;
			}
		}

		if (!permission || permission.access === false) {
			for (const field of fields) {
				(field as FormField).meta = {
					...(field.meta || {}),
					readonly: true,
					non_editable: true,
				};
			}
		} else if (permission.fields && !permission.fields.includes('*')) {
			for (const field of fields) {
				if (!permission.fields.includes(field.field)) {
					(field as FormField).meta = {
						...(field.meta || {}),
						readonly: true,
						non_editable: true,
					};
				}
			}
		}

		const presets = permission?.presets;

		if (presets) {
			for (const field of fields) {
				if (field.field in presets) {
					field.schema = {
						...(field.schema || {}),
						default_value: presets[field.field],
					} as Field['schema'];
				}
			}
		}

		return fields;
	});
}
