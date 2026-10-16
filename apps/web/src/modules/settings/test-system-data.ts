// Feature 016 (T114, T115): the system collections, fields and relations that Directus answers on every instance
// (`/collections`, `/fields`, `/relations`), built in the browser tests from directus/packages/system-data/src as
// Directus builds them (collections/index.ts, fields/index.ts processFields with _defaults.yaml, relations/index.ts).
// The fixture snapshot holds only the system rows the bo_* fields point at. Field types are not in the yaml (they come
// from the migrations): guessed from `special` (alias, cast-boolean, cast-json, uuid), enough for the forms to render.
import type { Field, Relation } from '@directus/types';
import { load } from 'js-yaml';

const sources = import.meta.glob<string>('../../../../../directus/packages/system-data/src/**/*.yaml', {
	query: '?raw',
	import: 'default',
	eager: true,
});

const yaml = (path: string) => {
	const key = Object.keys(sources).find((name) => name.endsWith(path));
	if (!key) throw new Error(`system-data: ${path} not found`);
	return load(sources[key]!) as Record<string, any>;
};

function typeOf(field: Record<string, any>): string {
	const special: string[] = field['special'] ?? [];
	if (special.some((s) => ['alias', 'no-data', 'group', 'o2m', 'm2m', 'm2a', 'translations'].includes(s)))
		return 'alias';
	if (special.includes('cast-boolean')) return 'boolean';
	if (special.includes('cast-json') || special.includes('cast-csv')) return 'json';
	if (special.includes('uuid')) return 'uuid';
	if (field['field'] === 'id') return 'integer';
	return 'string';
}

export function systemCollections(): Record<string, any>[] {
	const { defaults, data } = yaml('collections/collections.yaml');

	return (data as Record<string, any>[]).map((row) => ({
		collection: row['collection'],
		meta: { ...defaults, ...row, system: true },
		schema: { name: row['collection'] },
	}));
}

export function systemFields(): Field[] {
	const defaults = yaml('fields/_defaults.yaml');

	return Object.keys(sources)
		.filter((name) => /\/fields\/(?!_)[\w-]+\.yaml$/.test(name))
		.flatMap((name) => {
			const { table: collection, fields } = load(sources[name]!) as { table: string; fields: Record<string, any>[] };

			return fields.map((field, index) => {
				const type = typeOf(field);
				const meta = { system: true, ...defaults, ...field, collection, sort: index + 1 };

				return {
					collection,
					field: field['field'],
					name: field['field'],
					type,
					schema:
						type === 'alias'
							? null
							: { name: field['field'], table: collection, is_primary_key: field['field'] === 'id', is_nullable: true },
					meta,
				} as unknown as Field;
			});
		});
}

export function systemRelations(): Relation[] {
	const { defaults, data } = yaml('relations/relations.yaml');

	return (data as Record<string, any>[]).map((row) => {
		const meta = { ...defaults, ...row, system: true };

		return {
			collection: meta['many_collection'],
			field: meta['many_field'],
			related_collection: meta['one_collection'],
			schema: null,
			meta,
		} as unknown as Relation;
	});
}
