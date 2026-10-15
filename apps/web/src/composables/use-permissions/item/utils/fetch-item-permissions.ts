// Ported from directus/app/src/composables/use-permissions/item/utils/fetch-item-permissions.ts
// Backoffice: axios -> sdk (FR-001).
import { type ItemPermissions } from '@directus/types';
import { computedAsync } from '@vueuse/core';
import { ref, unref } from 'vue';
import { type Collection, type PrimaryKey } from '../../types/index.ts';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import { unexpectedError } from '../../../../utils/unexpected-error.ts';

const defaultPermissions: ItemPermissions = {
	update: {
		access: false,
	},
	delete: {
		access: false,
	},
	share: {
		access: false,
	},
};

export const fetchItemPermissions = (collection: Collection, primaryKey: PrimaryKey) => {
	const loading = ref(false);
	const refreshKey = ref(0);

	const fetchedItemPermissions = computedAsync(
		async () => {
			void refreshKey.value;

			const primaryKeyValue = unref(primaryKey);

			try {
				return await sdk.request<ItemPermissions>(
					requestEndpoint(
						`/permissions/me/${unref(collection)}${
							primaryKeyValue !== null ? `/${encodeURIComponent(primaryKeyValue)}` : ''
						}`,
					),
				);
			} catch (error) {
				unexpectedError(error);

				// Optimistic in case of errors to not block UI
				return {
					update: {
						access: true,
					},
					delete: {
						access: true,
					},
					share: {
						access: true,
					},
				};
			}
		},
		defaultPermissions,
		{ lazy: true, evaluating: loading },
	);

	const refresh = () => refreshKey.value++;

	return { loading, refresh, fetchedItemPermissions };
};
