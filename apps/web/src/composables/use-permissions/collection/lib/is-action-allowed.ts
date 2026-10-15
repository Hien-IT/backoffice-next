// Ported from directus/app/src/composables/use-permissions/collection/lib/is-action-allowed.ts
import type { PermissionsAction } from '@directus/types';
import { computed, unref } from 'vue';
import type { Collection } from '../../types/index.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';

export const isActionAllowed = (collection: Collection, action: PermissionsAction) => {
	const { hasPermission } = usePermissionsStore();

	return computed(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return false;

		return hasPermission(collectionValue, action);
	});
};
