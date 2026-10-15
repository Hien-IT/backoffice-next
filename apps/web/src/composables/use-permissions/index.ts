// Ported from directus/app/src/composables/use-permissions/index.ts
import { type ComputedRef, type MaybeRef } from 'vue';
import { type UsableCollectionPermissions, useCollectionPermissions } from './collection/use-collection-permissions.ts';
import { type UsableItemPermissions, useItemPermissions } from './item/use-item-permissions.ts';
import { isSaveAllowed } from './lib/is-save-allowed.ts';
import { type Collection, type IsNew, type PrimaryKey } from './types/index.ts';

export type UsablePermissions = {
	collectionPermissions: UsableCollectionPermissions;
	itemPermissions: UsableItemPermissions & { saveAllowed: ComputedRef<boolean> };
};

export function usePermissions(
	collection: Collection,
	primaryKey: PrimaryKey,
	isNew: IsNew,
	isVersion: MaybeRef<boolean> = false,
): UsablePermissions {
	const collectionPermissions = useCollectionPermissions(collection);

	const itemPermissions = useItemPermissions(collection, primaryKey, isNew, isVersion);

	const saveAllowed = isSaveAllowed(isNew, collectionPermissions.createAllowed, itemPermissions.updateAllowed);

	return {
		collectionPermissions,
		itemPermissions: { ...itemPermissions, saveAllowed },
	};
}

export { useCollectionPermissions, useItemPermissions };
