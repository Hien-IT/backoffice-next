// Backoffice (spec 005, D-209): a field hidden in the data model (directus_fields.hidden) of a user collection is
// left out of a wildcard expansion (`*`, `*.*`, no `fields`); named in `fields` it is returned like at DR. The primary
// key stays (convert-wildcards). System collections keep the DR answer. The map lives in the in-process schema cache
// like the 024 toggles, so clearSystemCache and the schemaChanged bus message clear it on every replica.
import { isSystemCollection } from '@backoffice/system-data';
import type { Knex } from 'knex';
import { getCache } from '../cache.js';
import getDatabase from '../database/index.js';

/** Hidden fields per user collection; a missing collection has none. */
export type HiddenFields = Record<string, string[]>;

const CACHE_KEY = 'hidden-fields';

/**
 * `knex`: the connection of the request (a transaction while an item is written). The read must not go to the shared
 * pool while that transaction holds its only connection: SQLite (pool of one) then waits forever (spec 030 fix).
 */
export async function getHiddenFields(knex: Knex = getDatabase()): Promise<HiddenFields> {
	const { localSchemaCache } = getCache();
	const cached = await localSchemaCache.get(CACHE_KEY);
	if (cached) return cached as HiddenFields;

	let rows: Record<string, any>[];

	try {
		rows = await knex.select('collection', 'field', 'hidden').from('directus_fields');
	} catch {
		// A failing database: the request reports it itself (like collection-toggles).
		return {};
	}

	const hidden: HiddenFields = {};

	for (const row of rows) {
		// vendors without a boolean type return 1
		if (row['hidden'] !== true && row['hidden'] !== 1) continue;
		if (isSystemCollection(row['collection'])) continue;
		(hidden[row['collection']] ??= []).push(row['field']);
	}

	await localSchemaCache.set(CACHE_KEY, hidden);
	return hidden;
}
