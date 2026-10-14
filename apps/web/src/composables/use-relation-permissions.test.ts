// Ported from directus/app/src/composables/use-relation-permissions.test.ts
// Backoffice: useCollectionPermissions is inlined in use-relation-permissions.ts (not ported on its own yet), so the
// `related` / `junction` refs of the Directus tests become `access` rows of the permissions store (/permissions/me)
// that `hasPermission` reads; the assertions are the Directus ones.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import { ref } from 'vue';
import { usePermissionsStore } from '../stores/permissions.ts';
import type { RelationM2A } from './use-relation-m2a.ts';
import type { RelationM2M } from './use-relation-m2m.ts';
import type { RelationM2O } from './use-relation-m2o.ts';
import type { RelationO2M } from './use-relation-o2m.ts';
import {
	useRelationPermissionsM2A,
	useRelationPermissionsM2M,
	useRelationPermissionsM2O,
	useRelationPermissionsO2M,
} from './use-relation-permissions.ts';

type Allowed = Record<'createAllowed' | 'updateAllowed' | 'deleteAllowed', { value: boolean }>;

const ACTIONS = { createAllowed: 'create', updateAllowed: 'update', deleteAllowed: 'delete' } as const;

/** `{ createAllowed, updateAllowed, deleteAllowed }` whose `.value = true|false` sets the collection's access. */
function permissionsOf(collection: string): Allowed {
	const store = usePermissionsStore();
	store.permissions[collection] = {};

	return Object.fromEntries(
		Object.entries(ACTIONS).map(([key, action]) => [
			key,
			{
				get value() {
					return store.permissions[collection]![action]?.access === 'full';
				},
				set value(allowed: boolean) {
					store.permissions[collection]![action] = { access: allowed ? 'full' : 'none' };
				},
			},
		]),
	) as Allowed;
}

beforeEach(() => {
	setActivePinia(createPinia());
});

test('useRelationPermissionsM2O', () => {
	const relationM2O = {
		relatedCollection: {
			collection: 'b',
		},
		type: 'm2o',
	} as RelationM2O;

	const related = permissionsOf('b');

	const permissions = useRelationPermissionsM2O(ref(relationM2O));

	expect(permissions.createAllowed.value).toBe(false);
	related.createAllowed.value = true;
	expect(permissions.createAllowed.value).toBe(true);

	expect(permissions.updateAllowed.value).toBe(false);
	related.updateAllowed.value = true;
	expect(permissions.updateAllowed.value).toBe(true);
});

test('useRelationPermissionsO2M', () => {
	const relationO2M = ref({
		relation: {
			meta: {
				one_deselect_action: 'nullify',
			},
		},
		relatedCollection: {
			collection: 'b',
		},
		type: 'o2m',
	} as RelationO2M);

	const related = permissionsOf('b');

	const permissions = useRelationPermissionsO2M(relationO2M);

	expect(permissions.createAllowed.value).toBe(false);
	related.createAllowed.value = true;
	expect(permissions.createAllowed.value).toBe(true);

	expect(permissions.updateAllowed.value).toBe(false);
	// corresponds to update value
	expect(permissions.deleteAllowed.value).toBe(false);
	related.updateAllowed.value = true;
	expect(permissions.updateAllowed.value).toBe(true);
	expect(permissions.deleteAllowed.value).toBe(true);

	relationO2M.value.relation.meta!.one_deselect_action = 'delete';
	// now corresponds to delete value
	expect(permissions.deleteAllowed.value).toBe(false);
	related.deleteAllowed.value = true;
	expect(permissions.deleteAllowed.value).toBe(true);
});

test('useRelationPermissionsM2M', () => {
	const relationM2M = ref({
		junctionCollection: {
			collection: 'a_b',
		},
		relatedCollection: {
			collection: 'b',
		},
		junction: {
			meta: {
				one_deselect_action: 'nullify',
			},
		},
	} as RelationM2M);

	const related = permissionsOf('b');

	const junction = permissionsOf('a_b');

	const permissions = useRelationPermissionsM2M(relationM2M);

	expect(permissions.createAllowed.value).toBe(false);
	expect(permissions.selectAllowed.value).toBe(false);
	related.createAllowed.value = true;
	expect(permissions.createAllowed.value).toBe(false);
	expect(permissions.selectAllowed.value).toBe(false);
	related.createAllowed.value = false;
	junction.createAllowed.value = true;
	expect(permissions.createAllowed.value).toBe(false);
	expect(permissions.selectAllowed.value).toBe(true);
	related.createAllowed.value = true;
	expect(permissions.createAllowed.value).toBe(true);
	expect(permissions.selectAllowed.value).toBe(true);

	expect(permissions.updateAllowed.value).toBe(false);
	// deleteAllowed corresponds to junction updateAllowed value
	expect(permissions.deleteAllowed.value).toBe(false);
	related.updateAllowed.value = true;
	expect(permissions.updateAllowed.value).toBe(false);
	expect(permissions.deleteAllowed.value).toBe(false);
	related.updateAllowed.value = false;
	junction.updateAllowed.value = true;
	expect(permissions.updateAllowed.value).toBe(false);
	expect(permissions.deleteAllowed.value).toBe(true);
	related.updateAllowed.value = true;
	expect(permissions.updateAllowed.value).toBe(true);
	expect(permissions.deleteAllowed.value).toBe(true);

	relationM2M.value.junction.meta!.one_deselect_action = 'delete';
	// deleteAllowed now corresponds to junction deleteAllowed value
	expect(permissions.deleteAllowed.value).toBe(false);
	junction.deleteAllowed.value = true;
	expect(permissions.deleteAllowed.value).toBe(true);
});

test('useRelationPermissionsM2A', () => {
	const relationM2A = ref({
		junctionCollection: {
			collection: 'a_b',
		},
		allowedCollections: [{ collection: 'a' }],
		junction: {
			meta: {
				one_deselect_action: 'nullify',
			},
		},
	} as RelationM2A);

	const junction = permissionsOf('a_b');

	const a = permissionsOf('a');

	const permissions = useRelationPermissionsM2A(relationM2A);

	expect(permissions.createAllowed.value['a']).toBe(false);
	expect(permissions.selectAllowed.value).toBe(false);
	a.createAllowed.value = true;
	expect(permissions.createAllowed.value['a']).toBe(false);
	expect(permissions.selectAllowed.value).toBe(false);
	a.createAllowed.value = false;
	junction.createAllowed.value = true;
	expect(permissions.createAllowed.value['a']).toBe(false);
	expect(permissions.selectAllowed.value).toBe(true);
	a.createAllowed.value = true;
	expect(permissions.createAllowed.value['a']).toBe(true);
	expect(permissions.selectAllowed.value).toBe(true);

	expect(permissions.updateAllowed.value['a']).toBe(false);
	// deleteAllowed corresponds to collection + junction updateAllowed value
	expect(permissions.deleteAllowed.value['a']).toBe(false);
	a.updateAllowed.value = true;
	expect(permissions.updateAllowed.value['a']).toBe(false);
	expect(permissions.deleteAllowed.value['a']).toBe(false);
	a.updateAllowed.value = false;
	junction.updateAllowed.value = true;
	expect(permissions.updateAllowed.value['a']).toBe(false);
	expect(permissions.deleteAllowed.value['a']).toBe(false);
	a.updateAllowed.value = true;
	expect(permissions.updateAllowed.value['a']).toBe(true);
	expect(permissions.deleteAllowed.value['a']).toBe(true);

	relationM2A.value.junction.meta!.one_deselect_action = 'delete';
	// deleteAllowed now corresponds to junction deleteAllowed value
	expect(permissions.deleteAllowed.value['a']).toBe(false);
	junction.deleteAllowed.value = true;
	expect(permissions.deleteAllowed.value['a']).toBe(true);
});
