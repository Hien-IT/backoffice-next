// Ported from directus/app/src/modules/users/composables/use-navigation.ts
// Backoffice: the request goes through the SDK; a failed read (403) opens the error dialog as Directus unexpectedError
// does and leaves the tree empty (CHK018). The roles and the open roles are shared by every caller, as in Directus.
import type { Role } from '@directus/types';
import { groupBy } from 'lodash-es';
import { computed, type Ref, ref, watch } from 'vue';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import { showUnexpectedError } from '../../../composables/use-notices.ts';

let roles: Ref<BasicRole[] | null> | null = null;
let loading: Ref<boolean> | null = null;

export type BasicRole = Pick<Role, 'id' | 'name' | 'icon' | 'parent'> & { children?: BasicRole[] };

const globalOpenRoles = ref<string[]>([]);

/** Test helper: forget the shared roles (module state of Directus). */
export function resetNavigationForTests() {
	roles = null;
	loading = null;
	globalOpenRoles.value = [];
}

export default function useNavigation(initialRole: Ref<string | undefined>): {
	roles: Ref<BasicRole[] | null>;
	roleTree: Ref<BasicRole[]>;
	openRoles: Ref<string[]>;
	loading: Ref<boolean>;
} {
	if (roles === null) {
		roles = ref<BasicRole[] | null>(null);
	}

	if (loading === null) {
		loading = ref(false);
	}

	if (loading?.value === false) {
		fetchRoles();
	}

	const roleTree = computed(() => {
		if (!roles?.value) return [];

		const root = Symbol();
		const rolesByParent = groupBy(roles.value, (role) => role.parent ?? root) as Record<string | symbol, BasicRole[]>;

		return rolesByParent[root]?.map(buildTree) ?? [];

		function buildTree(role: BasicRole): BasicRole {
			const children = rolesByParent[role.id];

			if (!children) return role;

			return {
				...role,
				children: children.map(buildTree),
			};
		}
	});

	watch(
		[() => initialRole.value, roles],
		() => {
			if (!initialRole?.value) return;
			if (globalOpenRoles.value.includes(initialRole.value!)) return;
			if (!roles?.value) return;

			let current = roles.value.find((role) => role.id === initialRole.value);

			while (current) {
				globalOpenRoles.value.push(current.id);
				current = roles.value.find((role) => role.id === current?.parent);
			}
		},
		{ immediate: true },
	);

	return { roles, roleTree, openRoles: globalOpenRoles, loading };

	async function fetchRoles() {
		if (!loading || !roles) return;
		if (!roles.value) loading.value = true;

		try {
			roles.value = await sdk.request(
				requestEndpoint<BasicRole[]>('/roles', {
					method: 'GET',
					params: { sort: 'name', fields: ['id', 'name', 'icon', 'parent'] },
				}),
			);
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			loading.value = false;
		}
	}
}
