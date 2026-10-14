// Ported from directus/app/src/composables/use-permissions/index.ts
// Backoffice: only `itemPermissions` (saveAllowed, deleteAllowed, fields) that translation-form.vue reads, on the
// permissions store (/permissions/me). Same rules as use-permissions/item (get-fields.ts, is-action-allowed.ts) and
// lib/is-save-allowed.ts. shortcut: /permissions/me/<collection>/<pk> is not in contracts/api-calls.md, so a `partial`
// permission counts as allowed (as DrawerItem.vue); the API still checks the item on save. Upgrade with the full port
// of use-permissions (014).
import type { Field } from '@directus/types';
import { cloneDeep } from 'lodash-es';
import { computed, type Ref, unref } from 'vue';
import { useCollection } from '../../composables/use-collection.ts';
import { type PermissionsAction, usePermissionsStore } from '../../stores/permissions.ts';
import { useUserStore } from '../../stores/user.ts';

export function usePermissions(
	collection: Ref<string | null>,
	_primaryKey: Ref<string | number | undefined>,
	isNew: Ref<boolean>,
) {
	const userStore = useUserStore();
	const { getPermission, hasPermission } = usePermissionsStore();
	const { fields: rawFields } = useCollection(collection);

	// use-permissions/item/lib/is-action-allowed.ts
	const isActionAllowed = (action: PermissionsAction) =>
		computed(() => {
			const collectionValue = unref(collection);
			if (!collectionValue || unref(isNew)) return false;
			return hasPermission(collectionValue, action);
		});

	const updateAllowed = isActionAllowed('update');
	const deleteAllowed = isActionAllowed('delete');

	// use-permissions/lib/is-save-allowed.ts with the collection createAllowed
	const saveAllowed = computed(() => {
		const collectionValue = unref(collection);
		if (unref(isNew)) return !!collectionValue && hasPermission(collectionValue, 'create');
		return updateAllowed.value;
	});

	// use-permissions/item/lib/get-fields.ts
	const fields = computed<Field[]>(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return [];

		let fields = cloneDeep(rawFields.value);

		if (userStore.isAdmin) return fields;

		const readableFields = getPermission(collectionValue, 'read')?.fields;

		// remove fields without read permissions so they don't show up in the DOM
		if (readableFields && !readableFields.includes('*')) {
			fields = fields.filter((field) => readableFields.includes(field.field));
		}

		const permission = getPermission(collectionValue, unref(isNew) ? 'create' : 'update');

		if (!permission || permission.access === 'none') {
			for (const field of fields) {
				field.meta = { ...(field.meta || {}), readonly: true, non_editable: true } as Field['meta'];
			}
		} else if (permission.fields && !permission.fields.includes('*')) {
			for (const field of fields) {
				if (!permission.fields.includes(field.field)) {
					field.meta = { ...(field.meta || {}), readonly: true, non_editable: true } as Field['meta'];
				}
			}
		}

		const presets = permission?.presets;

		if (presets) {
			for (const field of fields) {
				if (field.field in presets) {
					field.schema = { ...(field.schema || {}), default_value: presets[field.field] } as Field['schema'];
				}
			}
		}

		return fields;
	});

	return { itemPermissions: { saveAllowed, deleteAllowed, fields } };
}
