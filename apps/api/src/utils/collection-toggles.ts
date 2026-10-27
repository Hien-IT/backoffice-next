// Backoffice (spec 024, D-188): the bo_show_search, bo_show_import, bo_show_export toggles of directus_collections
// (spec 022) also block the HTTP layer. The map lives in the in-process schema cache, so clearSystemCache and the
// schemaChanged bus message clear it on every replica when either app saves a collection (research R1).
import type { Query, SchemaOverview } from '@backoffice/types';
import { isEmpty, isPlainObject } from 'lodash-es';
import { getCache } from '../cache.js';
import { getRelatedCollection } from '../database/get-ast-from-query/utils/get-related-collection.js';
import getDatabase from '../database/index.js';
import { createCollectionForbiddenError } from '../permissions/modules/process-ast/utils/validate-path/create-error.js';

export type Toggle = 'search' | 'import' | 'export';

/** Collections with at least one toggle off; a missing collection or toggle is shown. */
export type CollectionToggles = Record<string, Partial<Record<Toggle, false>>>;

const CACHE_KEY = 'collection-toggles';

const COLUMNS: Record<Toggle, string> = {
	search: 'bo_show_search',
	import: 'bo_show_import',
	export: 'bo_show_export',
};

export async function getCollectionToggles(): Promise<CollectionToggles> {
	const { localSchemaCache } = getCache();
	const cached = await localSchemaCache.get(CACHE_KEY);
	if (cached) return cached as CollectionToggles;

	let rows: Record<string, any>[];

	try {
		rows = await getDatabase()
			.select('collection', ...Object.values(COLUMNS))
			.from('directus_collections');
	} catch {
		// Missing columns mean shown (FR-008); start already stops without the migration 20261026A (spec 022 FR-016),
		// so this is a database that never ran it (tests) or a failing database, which the request then reports itself.
		return {};
	}

	const toggles: CollectionToggles = {};

	for (const row of rows) {
		for (const [toggle, column] of Object.entries(COLUMNS) as [Toggle, string][]) {
			// null means shown (FR-008); vendors without a boolean type return 0.
			if (row[column] === false || row[column] === 0) (toggles[row['collection']] ??= {})[toggle] = false;
		}
	}

	await localSchemaCache.set(CACHE_KEY, toggles);
	return toggles;
}

export async function hasSearchOff(): Promise<boolean> {
	return Object.values(await getCollectionToggles()).some((toggles) => toggles.search === false);
}

/** The error a caller without access gets, so a blocked request tells nothing more (FR-006). */
export async function assertToggle(collection: string, toggle: Toggle, path = ''): Promise<void> {
	if ((await getCollectionToggles())[collection]?.[toggle] === false) {
		throw createCollectionForbiddenError(path, collection);
	}
}

/**
 * `search` and `export` of a sanitized query on `collection`, and every `_search` of `deep` on the collection of its
 * level (FR-002, FR-004, FR-017). Deep keys can be aliases (`query.alias` at the root, `_alias` below) and a2o keys are
 * `field:collection`.
 */
export async function assertCollectionToggles(collection: string, query: Query, schema: SchemaOverview): Promise<void> {
	if (!query.search && !query.export && isEmpty(query.deep)) return;

	const toggles = await getCollectionToggles();
	if (isEmpty(toggles)) return;

	const check = (target: string, toggle: Toggle, path: string[]) => {
		if (toggles[target]?.[toggle] === false) throw createCollectionForbiddenError(path.join('.'), target);
	};

	if (query.search) check(collection, 'search', []);
	if (query.export) check(collection, 'export', []);

	walk(query.deep, collection, query.alias, []);

	function walk(level: unknown, current: string, alias: Record<string, string> | null | undefined, path: string[]) {
		if (!isPlainObject(level)) return;

		for (const [key, value] of Object.entries(level as Record<string, any>)) {
			if (key.startsWith('_') || !isPlainObject(value)) continue;

			const [name, a2oCollection] = key.split(':') as [string, string | undefined];
			const related = a2oCollection ?? getRelatedCollection(schema, current, alias?.[name] ?? name);
			if (!related) continue;

			if (value._search) check(related, 'search', [...path, key]);
			walk(value, related, value._alias, [...path, key]);
		}
	}
}
