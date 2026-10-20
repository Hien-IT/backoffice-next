// The route a notification opens (notifications-drawer.vue of Directus): its item, the collection page of a singleton or
// a notification without item, or the `item` itself when it is an app path. Shared by the drawer and the bell panel.
import { useCollectionsStore } from '../stores/collections.ts';
import { getCollectionRoute, getItemRoute } from './get-item-route.ts';

export function notificationTarget(notification: {
	collection?: string | null;
	item?: string | number | null;
}): string | undefined {
	const { collection, item } = notification;

	if (collection) {
		const itemCollection = useCollectionsStore().getCollection(collection);
		if (itemCollection?.meta?.singleton || !item) return getCollectionRoute(collection);
		return getItemRoute(collection, item);
	}

	return String(item).startsWith('/') ? String(item) : undefined;
}
