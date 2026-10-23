// Ported from directus/app/src/composables/use-relation-permissions.ts
// Backoffice: use-permissions/collection/use-collection-permissions.ts is not ported yet (the item screens of feature
// 014 need the rest of it); the create/update/delete part these composables read is inlined below, as in DR
// (isActionAllowed: `hasPermission` of the permissions store, read from /permissions/me, FR-041).
import { computed, type ComputedRef, type MaybeRef, type Ref, unref } from 'vue';
import { type PermissionsAction, usePermissionsStore } from '../stores/permissions.ts';
import type { RelationM2A } from './use-relation-m2a.ts';
import type { RelationM2M } from './use-relation-m2m.ts';
import type { RelationM2O } from './use-relation-m2o.ts';
import type { RelationO2M } from './use-relation-o2m.ts';

// shortcut: only the actions the relation table needs, upgrade to the full port of use-permissions with feature 014.
type UsableCollectionPermissions = Record<'createAllowed' | 'updateAllowed' | 'deleteAllowed', ComputedRef<boolean>>;

// Ported from directus/app/src/composables/use-permissions/collection/lib/is-action-allowed.ts
const isActionAllowed = (collection: MaybeRef<string | null>, action: PermissionsAction) => {
	const { hasPermission } = usePermissionsStore();

	return computed(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return false;

		return hasPermission(collectionValue, action);
	});
};

function useCollectionPermissions(collection: MaybeRef<string | null>): UsableCollectionPermissions {
	return {
		createAllowed: isActionAllowed(collection, 'create'),
		updateAllowed: isActionAllowed(collection, 'update'),
		deleteAllowed: isActionAllowed(collection, 'delete'),
	};
}

export function useRelationPermissionsM2O(info: Ref<RelationM2O | undefined>) {
	const relatedPermissions = useCollectionPermissions(computed(() => info.value?.relatedCollection.collection ?? null));

	return {
		createAllowed: relatedPermissions.createAllowed,
		updateAllowed: relatedPermissions.updateAllowed,
	};
}

export function useRelationPermissionsO2M(info: Ref<RelationO2M | undefined>) {
	const relatedPermissions = useCollectionPermissions(computed(() => info.value?.relatedCollection.collection ?? null));

	const deleteAllowed = computed(() => {
		if (info.value?.relation.meta?.one_deselect_action === 'delete') {
			return relatedPermissions.deleteAllowed.value;
		}

		return relatedPermissions.updateAllowed.value;
	});

	return {
		createAllowed: relatedPermissions.createAllowed,
		updateAllowed: relatedPermissions.updateAllowed,
		deleteAllowed,
	};
}

export function useRelationPermissionsM2M(info: Ref<RelationM2M | undefined>) {
	const relatedPermissions = useCollectionPermissions(computed(() => info.value?.relatedCollection.collection ?? null));

	const junctionPermissions = useCollectionPermissions(
		computed(() => info.value?.junctionCollection.collection ?? null),
	);

	const createAllowed = computed(
		() => junctionPermissions.createAllowed.value && relatedPermissions.createAllowed.value,
	);

	const selectAllowed = computed(() => junctionPermissions.createAllowed.value);

	const updateAllowed = computed(
		() => junctionPermissions.updateAllowed.value && relatedPermissions.updateAllowed.value,
	);

	const deleteAllowed = computed(() => {
		if (info.value?.junction.meta?.one_deselect_action === 'delete') {
			return junctionPermissions.deleteAllowed.value;
		}

		return junctionPermissions.updateAllowed.value;
	});

	return {
		createAllowed,
		selectAllowed,
		updateAllowed,
		deleteAllowed,
	};
}

export function useRelationPermissionsM2A(info: Ref<RelationM2A | undefined>) {
	const relatedPermissions = computed(() => {
		const permissions: Record<string, UsableCollectionPermissions> = {};

		for (const collection of info.value?.allowedCollections ?? []) {
			permissions[collection.collection] = useCollectionPermissions(collection.collection);
		}

		return permissions;
	});

	const junctionPermissions = useCollectionPermissions(
		computed(() => info.value?.junctionCollection.collection ?? null),
	);

	const createAllowed = computed(() => {
		return Object.fromEntries(
			Object.entries(relatedPermissions.value).map(([key, value]) => [
				key,
				value.createAllowed.value && junctionPermissions.createAllowed.value,
			]),
		);
	});

	const selectAllowed = computed(() => junctionPermissions.createAllowed.value);

	const updateAllowed = computed(() => {
		return Object.fromEntries(
			Object.entries(relatedPermissions.value).map(([key, value]) => [
				key,
				value.updateAllowed.value && junctionPermissions.updateAllowed.value,
			]),
		);
	});

	const deleteAllowed = computed(() => {
		if (info.value?.junction.meta?.one_deselect_action === 'delete') {
			return Object.fromEntries(
				Object.entries(relatedPermissions.value).map(([key]) => [key, junctionPermissions.deleteAllowed.value]),
			);
		}

		return Object.fromEntries(
			Object.entries(relatedPermissions.value).map(([key, value]) => [
				key,
				value.updateAllowed.value && junctionPermissions.updateAllowed.value,
			]),
		);
	});

	return {
		createAllowed,
		selectAllowed,
		deleteAllowed,
		updateAllowed,
	};
}
