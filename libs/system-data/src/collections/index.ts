// Ported from directus/packages/system-data/src/collections/index.ts
import { loadYaml } from '../load-yaml.js';
import type { BaseCollectionMeta, DataCollectionMeta } from '../types.js';
const systemData = loadYaml(new URL('./collections.yaml', import.meta.url));

export const systemCollectionRows: BaseCollectionMeta[] = (systemData['data'] as DataCollectionMeta[]).map(
	(row) =>
		({
			...(systemData['defaults'] as Partial<BaseCollectionMeta>),
			...row,
			system: true,
		}) as BaseCollectionMeta,
);

export const systemCollectionNames: string[] = (systemData['data'] as DataCollectionMeta[]).map(
	(row) => row['collection']!,
);

export function isSystemCollection(collection: string): boolean {
	// Backoffice (spec 022, D-181): backoffice_migrations is listed too.
	if (!collection.startsWith('directus_') && !collection.startsWith('backoffice_')) return false;

	return systemCollectionNames.includes(collection);
}
