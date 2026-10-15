// Ported from directus/app/src/composables/use-permissions/item/lib/is-action-allowed.ts
import type { ItemPermissions } from '@directus/types';
import { computed, type MaybeRef, type Ref, unref } from 'vue';
import type { Collection, IsNew } from '../../types/index.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useUserStore } from '../../../../stores/user.ts';

export const isActionAllowed = (
	collection: Collection,
	isNew: IsNew,
	fetchedItemPermissions: Ref<ItemPermissions>,
	action: 'update' | 'delete' | 'share',
	isVersion: MaybeRef<boolean> = false,
) => {
	const userStore = useUserStore();
	const { getPermission } = usePermissionsStore();

	const localPermissions = computed(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return false;

		if (unref(isNew)) return false;

		// Version editing bypasses underlying collection write permissions.
		// Field-level access is enforced by the backend at promote time.
		if (action === 'update' && unref(isVersion)) return true;

		if (userStore.isAdmin) return true;

		const permission = getPermission(collectionValue, action);

		if (!permission) return false;
		if (permission.access === 'full') return true;
		if (permission.access === 'none') return false;

		return null;
	});

	return computed(() => {
		if (localPermissions.value !== null) return localPermissions.value;

		return fetchedItemPermissions.value[action].access;
	});
};
