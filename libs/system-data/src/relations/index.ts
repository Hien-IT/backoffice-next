// Ported from directus/packages/system-data/src/relations/index.ts
import { loadYaml } from '../load-yaml.js';
import type { RelationMeta } from '../types.js';
const systemData = loadYaml(new URL('./relations.yaml', import.meta.url));

export const systemRelationRows: RelationMeta[] = (systemData['data'] as RelationMeta[]).map(
	(row) =>
		({
			...(systemData['defaults'] as Partial<RelationMeta>),
			...row,
			system: true,
		}) as RelationMeta,
);
