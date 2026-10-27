// Ported from directus/app/src/stores/permissions.ts
// Backoffice: action presets are kept raw; parsePreset ($NOW, $CURRENT_USER values) comes with the Content module
// (feature 014). @directus/types is not a dependency, so the permission shapes are typed locally.
import { mapValues } from 'lodash-es';
import { defineStore } from 'pinia';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useUserStore } from './user.ts';

// Backoffice (spec 025, D-189): import and export come from backoffice_permissions when the API is Backoffice.
export type PermissionsAction = 'create' | 'read' | 'update' | 'delete' | 'share' | 'import' | 'export';

export type ActionPermission = {
	access: 'none' | 'partial' | 'full';
	fields?: string[] | null;
	presets?: Record<string, unknown> | null;
	/** Backoffice (spec 025): the formats an import or export may use; absent = every format. */
	formats?: string[];
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
	getters: {
		/**
		 * Backoffice (spec 025, FR-034): /permissions/me of Backoffice carries import and export (D-189); the one of
		 * DR (proxy to DR, or an answer DR cached, D-189.2) does not, and the web app then follows
		 * the DR rules for import and export.
		 */
		hasBackofficeActions: (state) =>
			Object.values(state.permissions).some((collection) => collection && 'import' in collection),
	},
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
