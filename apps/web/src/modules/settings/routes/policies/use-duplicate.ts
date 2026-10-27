// Ported from directus/app/src/modules/settings/routes/policies/use-duplicate.ts
// Backoffice: requests through the SDK (FR-001), which returns `data`; errors open the error dialog (D-66).
import type { Permission, Policy } from '@directus/types';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';

export type PolicyItem = Policy & {
	userCount?: number;
	roleCount?: number;
};

export interface UseDuplicateOptions {
	source: Ref<PolicyItem | null>;
	name: Ref<string>;
	onSuccess: () => void | Promise<void>;
}

export function useDuplicate({ source, name, onSuccess }: UseDuplicateOptions) {
	const duplicating = ref(false);

	return { duplicating, duplicate };

	async function duplicate() {
		if (!source.value || !name.value || duplicating.value) return;

		const item = source.value;
		duplicating.value = true;

		try {
			const permissions = await sdk.request<Permission[]>(
				requestEndpoint('/permissions', {
					params: {
						filter: { policy: { _eq: item.id } },
						limit: -1,
						fields: ['collection', 'action', 'permissions', 'validation', 'presets', 'fields', 'policy'],
					},
				}),
			);

			const newPolicy = await sdk.request<{ id: string }>(
				requestEndpoint('/policies', {
					method: 'POST',
					body: {
						name: name.value,
						icon: item.icon,
						description: item.description,
						enforce_tfa: item.enforce_tfa,
						ip_access: item.ip_access,
						app_access: item.app_access,
						admin_access: item.admin_access,
					},
				}),
			);

			const newPolicyId: string = newPolicy.id;

			if (permissions.length > 0) {
				await sdk.request(
					requestEndpoint('/permissions', {
						method: 'POST',
						body: permissions.map((p) => ({ ...p, policy: newPolicyId })),
					}),
				);
			}

			// Backoffice (spec 025, FR-027): the import and export rows of backoffice_permissions too. A Directus API has no
			// such route (404): nothing to copy there (FR-034).
			const boPermissions = await sdk
				.request<Record<string, unknown>[]>(
					requestEndpoint('/backoffice/permissions', {
						params: {
							filter: { policy: { _eq: item.id } },
							limit: -1,
							fields: ['collection', 'action', 'permissions', 'validation', 'presets', 'fields', 'options'],
						},
					}),
				)
				.catch(() => []);

			if (boPermissions.length > 0) {
				await sdk.request(
					requestEndpoint('/backoffice/permissions', {
						method: 'POST',
						body: boPermissions.map((p) => ({ ...p, policy: newPolicyId })),
					}),
				);
			}

			await onSuccess();
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			duplicating.value = false;
		}
	}
}
