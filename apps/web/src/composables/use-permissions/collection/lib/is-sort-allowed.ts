// Ported from directus/app/src/composables/use-permissions/collection/lib/is-sort-allowed.ts
import { useCollection } from '../../../../composables/use-collection.ts';
import { computed, ref, unref } from 'vue';
import type { Collection } from '../../types/index.ts';
import { isFieldAllowed } from '../../utils/is-field-allowed.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useUserStore } from '../../../../stores/user.ts';

export const isSortAllowed = (collection: Collection) => {
	const { info: collectionInfo } = useCollection(ref(collection));
	const userStore = useUserStore();
	const { getPermission } = usePermissionsStore();

	return computed(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return false;

		const sortField = collectionInfo.value?.meta?.sort_field;
		if (!sortField) return false;

		if (userStore.isAdmin) return true;

		const permission = getPermission(collectionValue, 'update');
		if (!permission) return false;

		return isFieldAllowed(permission, sortField);
	});
};
