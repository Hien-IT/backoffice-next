// Ported from directus/app/src/stores/collections.ts
// Backoffice: the write actions (upsertCollection, updateCollection, deleteCollection) came with the Settings data model
// screens (016); notices are the toasts of D-172 (in place by D-66 before 2026-10-23); the AI tools hook is removed (D-54).
import formatTitle from '@directus/format-title';
import type { Collection as CollectionRaw, CollectionType, DeepPartial, Field } from '@directus/types';
import { getCollectionType } from '@directus/utils';
import { groupBy, isEqual, isNil, omit, orderBy } from 'lodash-es';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { notify, showUnexpectedError } from '../composables/use-notices.ts';
import { i18n } from '../lang/index.ts';
import { getLiteralInterpolatedTranslation } from '../utils/get-literal-interpolated-translation.ts';
import { useRelationsStore } from './relations.ts';

// Backoffice: directus/app/src/types/collections.ts, kept next to the store.
export interface Collection extends CollectionRaw {
	name: string;
	icon: string;
	type: CollectionType;
	color?: string | null | undefined;
}

// Backoffice: COLLECTIONS_DENY_LIST of directus/app/src/constants.ts.
const COLLECTIONS_DENY_LIST = [
	'directus_activity',
	'directus_collections',
	'directus_extensions',
	'directus_fields',
	'directus_migrations',
	'directus_relations',
	'directus_revisions',
	'directus_sessions',
	'directus_settings',
];

// Backoffice: @directus/system-data is not a dependency; the API reserves the `directus_` prefix for system
// collections, so the prefix alone tells them apart.
function isSystemCollection(collection: string): boolean {
	return collection.startsWith('directus_');
}

/**
 * Create a flat list of collections, in which grouped collections are sorted under their parent collection.
 * Sorted by `meta.sort` and `collection`.
 */
// Backoffice: directus/app/src/utils/flatten-grouped-collections.ts, inlined.
function flattenGroupedCollections(collections: Collection[]): Collection[] {
	const topLevelCollections = collections.filter((collection) => isNil(collection.meta?.group));

	const groupedCollections = groupBy(
		collections.filter((collection) => !isNil(collection.meta?.group)),
		'meta.group',
	);

	const flatten = (collections: Collection[]): Collection[] => {
		const result = [];

		for (const collection of orderBy(collections, ['meta.sort', 'collection'])) {
			result.push(collection);

			if (groupedCollections[collection.collection]) {
				result.push(...flatten(groupedCollections[collection.collection]!));
			}
		}

		return result;
	};

	return flatten(topLevelCollections);
}

export const useCollectionsStore = defineStore('collectionsStore', () => {
	const collections = ref<Collection[]>([]);

	const sortedCollections = computed(() => flattenGroupedCollections(collections.value));

	/**
	 * All system collections
	 */
	const systemCollections = computed(() =>
		sortedCollections.value.filter(({ collection }) => isSystemCollection(collection)),
	);

	/**
	 * All collections excluding system collections
	 */
	const allCollections = computed(() =>
		sortedCollections.value.filter(({ collection }) => isSystemCollection(collection) === false),
	);

	/**
	 * All non-system collections that have a meta object, i.e. are configured in DR
	 */
	const configuredCollections = computed(() => allCollections.value.filter((collection) => collection.meta));

	/**
	 * All non-system collections that are configured and visible (not hidden)
	 */
	const visibleCollections = computed(() =>
		configuredCollections.value.filter((collection) => collection.meta?.hidden !== true),
	);

	/**
	 * All non-system collections that are configured and have a corresponding database table
	 */
	const databaseCollections = computed(() => allCollections.value.filter((collection) => collection.schema));

	/**
	 * All system collections that are safe to CRUD
	 */
	const crudSafeSystemCollections = computed(() =>
		systemCollections.value.filter((collection) => !COLLECTIONS_DENY_LIST.includes(collection.collection)),
	);

	return {
		collections,
		sortedCollections,
		allCollections,
		visibleCollections,
		configuredCollections,
		databaseCollections,
		systemCollections,
		crudSafeSystemCollections,
		hydrate,
		dehydrate,
		prepareCollectionForApp,
		translateCollections,
		upsertCollection,
		updateCollection,
		deleteCollection,
		getCollection,
	};

	async function hydrate() {
		const rawCollections = await sdk.request(requestEndpoint<CollectionRaw[]>('/collections', { method: 'GET' }));

		collections.value = rawCollections.map(prepareCollectionForApp);
	}

	async function dehydrate() {
		collections.value = [];
	}

	function prepareCollectionForApp(collection: CollectionRaw): Collection {
		const icon = collection.meta?.icon || 'database';
		const color = collection.meta?.color;
		// Backoffice (018 D-117, owner 2026-10-18; branding D-51): system collections drop the `directus_` prefix from their
		// name ("Users", not "DR Users"); translated names still win below.
		let name = formatTitle(collection.collection.replace(/^directus_/, ''));
		const type = getCollectionType(collection);

		const localesToKeep =
			collection.meta && !isNil(collection.meta.translations) && Array.isArray(collection.meta.translations)
				? collection.meta.translations.map((translation) => translation.language)
				: [];

		for (const locale of i18n.global.availableLocales) {
			if (i18n.global.te(`collection_names.${collection.collection}`, locale) && !localesToKeep.includes(locale)) {
				i18n.global.mergeLocaleMessage(locale, { collection_names: { [collection.collection]: undefined } });
			}
		}

		if (collection.meta && Array.isArray(collection.meta.translations)) {
			for (const { language, translation, singular, plural } of collection.meta.translations) {
				i18n.global.mergeLocaleMessage(language, {
					...(translation
						? {
								collection_names: {
									[collection.collection]: getLiteralInterpolatedTranslation(translation),
								},
							}
						: {}),
					...(singular
						? {
								collection_names_singular: {
									[collection.collection]: getLiteralInterpolatedTranslation(singular),
								},
							}
						: {}),
					...(plural
						? {
								collection_names_plural: {
									[collection.collection]: getLiteralInterpolatedTranslation(plural),
								},
							}
						: {}),
				});
			}
		}

		if (i18n.global.te(`collection_names.${collection.collection}`)) {
			name = i18n.global.t(`collection_names.${collection.collection}`);
		}

		return {
			...collection,
			name,
			type,
			icon,
			color,
		};
	}

	function translateCollections() {
		collections.value = collections.value.map((collection) => {
			if (i18n.global.te(`collection_names.${collection.collection}`)) {
				collection.name = i18n.global.t(`collection_names.${collection.collection}`);
			}

			return collection;
		});
	}

	async function upsertCollection(collection: string, values: DeepPartial<Collection & { fields: Field[] }>) {
		const existing = getCollection(collection);

		// Strip out any fields the app might've auto-generated at some point
		const rawValues = omit(values, ['name', 'type', 'icon', 'color']);

		if (existing) {
			if (isEqual(existing, values)) return;

			const updated = await sdk.request(
				requestEndpoint<CollectionRaw>(`/collections/${collection}`, { method: 'PATCH', body: rawValues }),
			);

			collections.value = collections.value.map((existingCollection) =>
				existingCollection.collection === collection ? prepareCollectionForApp(updated) : existingCollection,
			);
		} else {
			const created = await sdk.request(
				requestEndpoint<CollectionRaw>('/collections', { method: 'POST', body: rawValues }),
			);

			collections.value = [...collections.value, prepareCollectionForApp(created)];
		}
	}

	async function updateCollection(collection: string, updates: DeepPartial<Collection>) {
		try {
			await sdk.request(requestEndpoint(`/collections/${collection}`, { method: 'PATCH', body: updates }));
			await hydrate();

			notify({ title: i18n.global.t('update_collection_success'), type: 'success' });
		} catch (error) {
			showUnexpectedError(error);
		}
	}

	async function deleteCollection(collection: string) {
		const relationsStore = useRelationsStore();

		try {
			await sdk.request(requestEndpoint(`/collections/${collection}`, { method: 'DELETE' }));
			await Promise.all([hydrate(), relationsStore.hydrate()]);

			notify({ title: i18n.global.t('delete_collection_success'), type: 'success' });
		} catch (error) {
			showUnexpectedError(error);
		}
	}

	function getCollection(collectionKey: string): Collection | null {
		return collections.value.find((collection) => collection.collection === collectionKey) || null;
	}
});
