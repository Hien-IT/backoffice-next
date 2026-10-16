// Ported from directus/app/src/modules/settings/routes/roles/use-save.ts
// Backoffice: the request goes through the SDK (FR-001), which returns `data`; errors open the error dialog (D-66).
import type { Ref } from 'vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';

export interface UseSaveOptions {
	name: Ref<string | null>;
}

export function useSave({ name }: UseSaveOptions) {
	const router = useRouter();

	const saving = ref(false);

	return { saving, save };

	async function save() {
		if (name.value === null || saving.value) return;

		saving.value = true;

		try {
			const role = await sdk.request<{ id: string }>(
				requestEndpoint('/roles', { method: 'POST', body: { name: name.value } }),
			);

			router.push({ name: 'settings-roles-item', params: { primaryKey: role.id } });
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			saving.value = false;
		}
	}
}
