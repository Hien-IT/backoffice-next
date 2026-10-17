// Ported from directus/app/src/panels/relational-variable/use-display-items.ts
// Backoffice (spec 018 FR-051, FR-052, FR-055, FR-056): the shared SDK client of api/sdk.ts instead of useSdk; errors
// open the error dialog through showUnexpectedError.
import type { Item } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { computed, type Ref, ref, watch } from 'vue';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { showUnexpectedError } from '../../composables/use-notices.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';

export default function useDisplayItems(
	collection: Ref<string>,
	template: Ref<string | undefined>,
	ids: Ref<(string | number)[] | undefined>,
) {
	const collectionsStore = useCollectionsStore();
	const fieldStore = useFieldsStore();

	const loading = ref(false);
	const displayItems: Ref<Item[]> = ref([]);

	const primaryKey = computed(() => fieldStore.getPrimaryKeyFieldForCollection(collection.value)?.field ?? '');

	const displayTemplate = computed(() => {
		if (template.value) return template.value;

		const displayTemplate = collectionsStore.getCollection(collection.value)?.meta?.display_template;

		return displayTemplate || `{{ ${primaryKey.value || 'id'} }}`;
	});

	const requiredFields = computed(() => {
		if (!displayTemplate.value || !collection.value) return [];
		return adjustFieldsForDisplays(getFieldsFromTemplate(displayTemplate.value), collection.value);
	});

	watch(ids, getDisplayItems, { immediate: true });

	return { displayItems, displayTemplate, loading, primaryKey };

	async function getDisplayItems() {
		if (!ids.value || ids.value.length === 0) {
			displayItems.value = [];
			return;
		}

		if (!collection.value || !primaryKey.value) return;

		const fields = new Set(requiredFields.value);
		fields.add(primaryKey.value);

		try {
			loading.value = true;

			const response = await sdk.request<Item[]>(
				requestEndpoint(getEndpoint(collection.value), {
					params: {
						fields: Array.from(fields),
						filter: { [primaryKey.value]: { _in: ids.value } },
					},
				}),
			);

			displayItems.value = response;
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			loading.value = false;
		}
	}
}
