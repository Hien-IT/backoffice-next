// Ported from directus/app/src/modules/settings/routes/data-model/utils/collection-exists.ts
import { useCollectionsStore } from '../../../../../stores/collections.ts';

export function collectionExists(collection: string) {
	return !!useCollectionsStore().getCollection(collection);
}
