// Ported from directus/app/src/modules/content/index.ts
// Backoffice: route components are lazy (bundle budget, plan §Performance); the last accessed collection key is
// `backoffice-last-accessed-collection` (D-39); NoCollections is a module of its own so the guard stays testable.
import type { Collection } from '@directus/types';
import { useLocalStorage } from '@vueuse/core';
import { isNil, orderBy } from 'lodash-es';
import type { LocationQuery, NavigationGuard } from 'vue-router';
import { useCollectionsStore } from '../stores/collections.ts';
import { addQueryToPath } from '../utils/add-query-to-path.ts';
import { getCollectionRoute, getItemRoute, getSystemCollectionRoute } from '../utils/get-item-route.ts';
import RouterPass from '../utils/router-passthrough.ts';
import { useNavigation } from './content/composables/use-navigation.ts';
import { defineModule } from './types.ts';

export const LAST_ACCESSED_COLLECTION = 'backoffice-last-accessed-collection';

export const checkForSystem: NavigationGuard = (to, from) => {
	if (!to.params?.['collection']) return;

	if (typeof to.params['collection'] === 'string') {
		const route = getSystemCollectionRoute(to.params['collection']);

		if (route) {
			if (typeof to.params['primaryKey'] === 'string') {
				return getItemRoute(to.params['collection'], to.params['primaryKey']);
			} else {
				return route;
			}
		}
	}

	if (
		'bookmark' in from.query &&
		typeof from.query['bookmark'] === 'string' &&
		'bookmark' in to.query === false &&
		to.params['collection'] === from.params['collection'] &&
		'primaryKey' in to.params
	) {
		return addQueryToPath(to.fullPath, { bookmark: from.query['bookmark'] });
	}

	return;
};

export const getArchiveValue = (query: LocationQuery) => {
	if ('all' in query) {
		return 'all';
	} else if ('archived' in query) {
		return 'archived';
	} else {
		return null;
	}
};

/** The `beforeEnter` of /content: the last accessed collection, else the first root collection (open groups first). */
export function redirectToFirstCollection() {
	const collectionsStore = useCollectionsStore();
	const { activeGroups } = useNavigation();

	if (collectionsStore.visibleCollections.length === 0) return;

	const rootCollections = collectionsStore.visibleCollections.filter((collection) => isNil(collection?.meta?.group));

	const lastAccessedCollection = useLocalStorage<string | null>(LAST_ACCESSED_COLLECTION, null);

	if (
		typeof lastAccessedCollection.value === 'string' &&
		collectionsStore.visibleCollections.find(
			(visibleCollection) => visibleCollection.collection === lastAccessedCollection.value,
		)
	) {
		return getCollectionRoute(lastAccessedCollection.value);
	}

	let firstCollection = findFirst(rootCollections);

	// If the first collection couldn't be found in any open collections, try again but with closed collections
	firstCollection = findFirst(rootCollections, { skipClosed: false });

	if (!firstCollection) return;

	return getCollectionRoute(firstCollection.collection);

	function findFirst(collections: Collection[], { skipClosed } = { skipClosed: true }): Collection | void {
		for (const collection of collections) {
			if (collection.schema) {
				return collection;
			}

			// Don't default to a collection in a currently closed folder
			if (skipClosed && activeGroups.value.includes(collection.collection) === false) continue;

			const children = orderBy(
				collectionsStore.visibleCollections.filter((childCollection) => {
					return collection.collection === childCollection.meta?.group;
				}),
				['meta.sort', 'collection'],
			);

			const first = findFirst(children);

			if (first) return first;
		}
	}
}

export default defineModule({
	id: 'content',
	name: '$t:content',
	icon: 'box',
	routes: [
		{
			name: 'no-collections',
			path: '',
			component: () => import('./content/routes/NoCollections.vue'),
			beforeEnter: redirectToFirstCollection,
		},
		{
			path: ':collection',
			component: RouterPass,
			children: [
				{
					name: 'content-collection',
					path: '',
					component: () => import('./content/routes/CollectionOrItem.vue'),
					props: (route) => {
						const archive = getArchiveValue(route.query);
						return {
							collection: route.params['collection'],
							bookmark: route.query['bookmark'],
							archive,
						};
					},
					beforeEnter: checkForSystem,
				},
				{
					name: 'content-item',
					path: ':primaryKey',
					component: () => import('./content/routes/ItemRoute.vue'),
					props: true,
					beforeEnter: checkForSystem,
				},
			],
		},
		{
			name: 'content-item-preview',
			path: ':collection/:primaryKey/preview',
			component: () => import('./content/routes/PreviewRoute.vue'),
			props: true,
		},
		{
			name: 'content-item-not-found',
			path: ':_(.+)+',
			component: () => import('./content/routes/ContentNotFound.vue'),
			beforeEnter: checkForSystem,
		},
	],
});
