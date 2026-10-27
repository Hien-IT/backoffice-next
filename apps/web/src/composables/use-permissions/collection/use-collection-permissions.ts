// Ported from directus/app/src/composables/use-permissions/collection/use-collection-permissions.ts
import { type ComputedRef, computed, unref } from 'vue';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useUserStore } from '../../../stores/user.ts';
import { isSystemCollection } from '../../../utils/get-item-route.ts';
import { isArchiveAllowed } from '../lib/is-archive-allowed.ts';
import type { Collection } from '../types/index.ts';
import { isActionAllowed } from './lib/is-action-allowed.ts';
import { isRevisionsAllowed } from './lib/is-revisions-allowed.ts';
import { isSortAllowed } from './lib/is-sort-allowed.ts';

export type UsableCollectionPermissions = {
	readAllowed: ComputedRef<boolean>;
	createAllowed: ComputedRef<boolean>;
	updateAllowed: ComputedRef<boolean>;
	deleteAllowed: ComputedRef<boolean>;
	sortAllowed: ComputedRef<boolean>;
	archiveAllowed: ComputedRef<boolean>;
	revisionsAllowed: ComputedRef<boolean>;
	/** Backoffice (spec 025, FR-028): may the user import into or export the collection. */
	importAllowed: ComputedRef<boolean>;
	exportAllowed: ComputedRef<boolean>;
	/** Backoffice (spec 025, FR-017): the export formats the user may use; null is every format. */
	exportFormats: ComputedRef<string[] | null>;
};

/** Permissions on collection level */
export function useCollectionPermissions(collection: Collection): UsableCollectionPermissions {
	const readAllowed = isActionAllowed(collection, 'read');
	const createAllowed = isActionAllowed(collection, 'create');
	const updateAllowed = isActionAllowed(collection, 'update');
	const deleteAllowed = isActionAllowed(collection, 'delete');

	const sortAllowed = isSortAllowed(collection);
	const archiveAllowed = isArchiveAllowed(collection, updateAllowed);
	const revisionsAllowed = isRevisionsAllowed();

	// Backoffice (spec 025, FR-028, FR-034, research R8): import and export from /permissions/me when the API is
	// Backoffice, otherwise the DR rules (export needs read, import create and update). Import into a system collection
	// is admin-only in both, as the DR ImportService.
	const permissionsStore = usePermissionsStore();
	const userStore = useUserStore();
	const bo = computed(() => permissionsStore.hasBackofficeActions);

	const exportAllowed = computed(() => {
		const name = unref(collection);
		if (!name) return false;
		return bo.value ? permissionsStore.hasPermission(name, 'export') : readAllowed.value;
	});

	const importAllowed = computed(() => {
		const name = unref(collection);
		if (!name) return false;
		if (isSystemCollection(name)) return userStore.isAdmin;
		return bo.value ? permissionsStore.hasPermission(name, 'import') : createAllowed.value && updateAllowed.value;
	});

	const exportFormats = computed(() => {
		const name = unref(collection);
		if (!bo.value || !name) return null;
		return permissionsStore.getPermission(name, 'export')?.formats ?? null;
	});

	return {
		readAllowed,
		createAllowed,
		updateAllowed,
		deleteAllowed,
		sortAllowed,
		archiveAllowed,
		revisionsAllowed,
		importAllowed,
		exportAllowed,
		exportFormats,
	};
}
