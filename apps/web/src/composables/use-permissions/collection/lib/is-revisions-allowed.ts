// Ported from directus/app/src/composables/use-permissions/collection/lib/is-revisions-allowed.ts
import { computed } from 'vue';
import { usePermissionsStore } from '../../../../stores/permissions.ts';

export const isRevisionsAllowed = () => {
	const { hasPermission } = usePermissionsStore();

	return computed(() => hasPermission('directus_revisions', 'read'));
};
