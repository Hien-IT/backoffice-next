// Ported from directus/app/src/modules/settings/routes/policies/use-save.ts
// Backoffice: requests through the SDK (FR-001), which returns `data`; errors open the error dialog (D-66).
// `appAccessMinimalPermissions` of @directus/system-data is the `minimal` list of src/permissions/app-permissions-data.json
// (generated from the Directus 11.17.4 sources, with the same defaults on each row).
import type { Ref } from 'vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import appPermissions from '../../../../permissions/app-permissions-data.json';

const appAccessMinimalPermissions = appPermissions.minimal;

export interface UseSaveOptions {
	name: Ref<string | null>;
	adminAccess: Ref<boolean>;
	appAccess: Ref<boolean>;
}

export function useSave({ name, adminAccess, appAccess }: UseSaveOptions) {
	const router = useRouter();

	const saving = ref(false);

	return { saving, save };

	async function save() {
		if (name.value === null || saving.value) return;

		saving.value = true;

		try {
			const policy = await sdk.request<{ id: string }>(
				requestEndpoint('/policies', {
					method: 'POST',
					body: {
						name: name.value,
						admin_access: adminAccess.value,
						app_access: appAccess.value,
					},
				}),
			);

			if (appAccess.value === true && adminAccess.value === false) {
				await sdk.request(
					requestEndpoint('/permissions', {
						method: 'POST',
						body: appAccessMinimalPermissions.map((permission) => ({
							...permission,
							policy: policy.id,
						})),
					}),
				);
			}

			router.push({ name: 'settings-policies-item', params: { primaryKey: policy.id } });
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			saving.value = false;
		}
	}
}
