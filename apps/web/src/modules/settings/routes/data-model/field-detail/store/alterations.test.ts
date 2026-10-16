// Feature 016 (T050, SC-006): the ten alterations of the field detail store.
// 1. The port is the Directus source: every alteration and data-model util differs from directus/app/src only in its
//    imports, the `_state` name of unused parameters and the one `return` of global.ts (noImplicitReturns).
// 2. Twenty sample edits (the simple-mode order: interface, key, related collection) give the `fieldUpdates`,
//    `collections`, `fields`, `relations` and `items` recorded in __snapshots__ (a change there is a behaviour change).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocalType } from '@directus/types';
import { pick } from 'lodash-es';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useCollectionsStore } from '../../../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../../../stores/relations.ts';
import { useFieldDetailStore } from './index.ts';
import type { StateUpdates } from './types.ts';

vi.mock('../../../../../../api/sdk.ts', () => ({
	requestEndpoint: (path: string) => path,
	sdk: { request: () => Promise.resolve({}) },
}));

const here = dirname(fileURLToPath(import.meta.url));
const directus = join(here, '../../../../../../../../../directus/app/src/modules/settings/routes/data-model');

function normalize(text: string): string {
	return text
		.split('\n')
		.filter(
			(line) => !line.startsWith('import ') && !line.startsWith('// Ported from') && !line.startsWith('// Backoffice'),
		)
		.join('\n')
		.replaceAll('_state: State', 'state: State')
		.replaceAll(".ts';", "';")
		.replace('\tif (!chosenInterface.value) return updates;', '\tif (!chosenInterface.value) return;')
		.trim();
}

describe('the port is the Directus source', () => {
	const files = [
		...readdirSync(join(here, 'alterations')).map((name) => [
			`field-detail/store/alterations/${name}`,
			join(here, 'alterations', name),
		]),
		...['collection-exists.ts', 'field-exists.ts', 'get-junction-collection-name.ts'].map((name) => [
			`utils/${name}`,
			join(here, '../../utils', name),
		]),
	];

	test.each(files)('%s', (source, port) => {
		expect(normalize(readFileSync(port!, 'utf8'))).toBe(normalize(readFileSync(join(directus, source!), 'utf8')));
	});
});

/* --------------------------------------------------------------------------------------------- sample edits */

const pk = (collection: string, field = 'id', type = 'integer') => ({
	collection,
	field,
	type,
	name: field,
	schema: { is_primary_key: true, has_auto_increment: type === 'integer' },
	meta: { id: 1, collection, field, special: null, interface: 'input', hidden: true },
});

const plain = (collection: string, field: string, type = 'string', meta: Record<string, unknown> = {}) => ({
	collection,
	field,
	type,
	name: field,
	schema: { is_primary_key: false },
	meta: { id: 2, collection, field, special: null, interface: 'input', ...meta },
});

beforeEach(() => {
	setActivePinia(createPinia());

	const collections = useCollectionsStore();
	collections.collections = [
		'articles',
		'authors',
		'languages',
		'articles_authors',
		'directus_users',
		'directus_files',
	].map((collection) => collections.prepareCollectionForApp({ collection, schema: {}, meta: {} } as never));

	useFieldsStore().fields = [
		pk('articles'),
		plain('articles', 'title'),
		pk('authors'),
		pk('languages', 'code', 'string'),
		pk('articles_authors'),
		plain('articles_authors', 'articles_id', 'integer'),
		plain('articles_authors', 'authors_id', 'integer'),
		pk('directus_users', 'id', 'uuid'),
		pk('directus_files', 'id', 'uuid'),
	] as never;

	useRelationsStore().relations = [];
});

/** Simple mode: pick the interface, type the key, then the relation settings of the configuration form. */
async function edit(localType: LocalType, iface: string | null, key: string, ...more: StateUpdates[]) {
	const store = useFieldDetailStore();
	await store.startEditing('articles', '+', localType);
	if (iface) store.update({ field: { meta: { interface: iface } } });
	store.update({ field: { field: key } });
	for (const updates of more) store.update(updates);
	return pick(store.$state, ['localType', 'fieldUpdates', 'collections', 'fields', 'relations', 'items']);
}

const m2o = (related_collection: string): StateUpdates => ({ relations: { m2o: { related_collection } } });

describe('alterations (SC-006)', () => {
	test.each([
		['m2o, related collection exists', 'm2o', 'select-dropdown-m2o', 'author', [m2o('authors')]],
		['m2o, related collection is new', 'm2o', 'select-dropdown-m2o', 'editor', [m2o('editors')]],
		[
			'o2m, related collection exists',
			'o2m',
			'list-o2m',
			'links',
			[{ relations: { o2m: { collection: 'articles_authors', field: 'articles_id' } } }],
		],
		[
			'o2m, related collection is new',
			'o2m',
			'list-o2m',
			'comments',
			[{ relations: { o2m: { collection: 'comments' } } }],
		],
		['m2m, related collection exists', 'm2m', 'list-m2m', 'writers', [m2o('authors')]],
		['m2m, related collection is new', 'm2m', 'list-m2m', 'tags', [m2o('tags')]],
		[
			'm2a, allowed collections exist',
			'm2a',
			'list-m2a',
			'blocks',
			[{ relations: { m2o: { meta: { one_allowed_collections: ['authors'] } } } }],
		],
		[
			'm2a, an allowed collection is new',
			'm2a',
			'list-m2a',
			'sections',
			[{ relations: { m2o: { meta: { one_allowed_collections: ['authors', 'headings'] } } } }],
		],
		['translations, languages collection exists', 'translations', 'translations', 'translations', [m2o('languages')]],
		['translations, languages collection is new', 'translations', 'translations', 'translations', [m2o('locales')]],
		['file', 'file', 'file', 'cover', []],
		['files', 'files', 'files', 'gallery', []],
		['standard string', 'standard', 'input', 'subtitle', []],
		['standard integer', 'standard', 'slider', 'rating', []],
		['presentation', 'presentation', 'presentation-divider', 'divider', []],
		['group', 'group', 'group-detail', 'meta_group', []],
		['m2o to itself', 'm2o', 'select-dropdown-m2o', 'parent', [m2o('articles')]],
		[
			'o2m to itself',
			'o2m',
			'list-o2m',
			'children',
			[{ relations: { o2m: { collection: 'articles', field: 'parent' } } }],
		],
		[
			'm2m with an existing junction collection',
			'm2m',
			'list-m2m',
			'authors',
			[m2o('authors'), { relations: { o2m: { collection: 'articles_authors' } } }],
		],
	] as const)('%s', async (_name, localType, iface, key, more) => {
		expect(await edit(localType as LocalType, iface, key, ...(more as unknown as StateUpdates[]))).toMatchSnapshot();
	});

	test('an existing field gets another interface', async () => {
		const store = useFieldDetailStore();
		await store.startEditing('articles', 'title');
		store.update({ field: { meta: { interface: 'input-multiline' } } });

		expect(
			pick(store.$state, ['localType', 'fieldUpdates', 'collections', 'fields', 'relations', 'items']),
		).toMatchSnapshot();
	});
});
