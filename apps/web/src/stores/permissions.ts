// Ported from directus/app/src/stores/permissions.ts
// Backoffice: action presets are kept raw; parsePreset ($NOW, $CURRENT_USER values) comes with the Content module
// (feature 014). @directus/types is not a dependency, so the permission shapes are typed locally.
import { mapValues } from 'lodash-es';
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useUserStore } from './user.ts';

export type PermissionsAction = 'create' | 'read' | 'update' | 'delete' | 'share';

export type ActionPermission = {
	access: 'none' | 'partial' | 'full';
	fields?: string[] | null;
	presets?: Record<string, unknown> | null;
	[key: string]: unknown;
};

export type CollectionPermission = Partial<Record<PermissionsAction, ActionPermission>>;

export type CollectionAccess = Record<string, CollectionPermission>;

/** Calls `fn` on every non-object leaf of `value` (the part of deepMap from @directus/utils the store needs). */
function deepVisit(value: unknown, fn: (leaf: unknown) => void): void {
	if (value && typeof value === 'object') {
		for (const child of Object.values(value)) deepVisit(child, fn);
	} else {
		fn(value);
	}
}

export const usePermissionsStore = defineStore('permissionsStore', {
	state: () => ({
		permissions: {} as CollectionAccess,
	}),
	actions: {
		async hydrate() {
			const userStore = useUserStore();

			const response = await sdk.request(requestEndpoint<CollectionAccess>('/permissions/me', { method: 'GET' }));

			const fields = getNestedDynamicVariableFields(response);

			if (fields.length > 0) {
				await userStore.hydrateAdditionalFields(fields);
			}

			this.permissions = mapValues(response, (collectionPermission) => collectionPermission);

			function getNestedDynamicVariableFields(rawPermissions: CollectionAccess) {
				const fields = new Set<string>();

				const checkDynamicVariable = (value: unknown) => {
					if (typeof value !== 'string') return;

					if (value.startsWith('$CURRENT_USER.')) {
						fields.add(value.replace('$CURRENT_USER.', ''));
					} else if (value.startsWith('$CURRENT_ROLE.')) {
						fields.add(value.replace('$CURRENT_ROLE.', 'role.'));
					}
				};

				Object.values(rawPermissions).forEach((collectionPermission) => {
					Object.values(collectionPermission).forEach((actionPermission) => {
						deepVisit(actionPermission?.presets, checkDynamicVariable);
					});
				});

				return Array.from(fields);
			}
		},
		dehydrate() {
			this.$reset();
		},
		getPermission(collection: string, action: PermissionsAction) {
			return this.permissions[collection]?.[action] ?? null;
		},
		hasPermission(collection: string, action: PermissionsAction) {
			const userStore = useUserStore();

			if (userStore.isAdmin) return true;

			return (this.getPermission(collection, action)?.access ?? 'none') !== 'none';
		},
	},
});
