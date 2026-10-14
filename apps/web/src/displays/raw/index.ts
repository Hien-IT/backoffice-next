// Ported from directus/app/src/displays/raw/index.ts
import { defineDisplay } from '../types.ts';

// Backoffice: TYPES and LOCAL_TYPES of @directus/constants (not a dependency of apps/web), copied.
const TYPES = [
	'bigInteger',
	'boolean',
	'date',
	'dateTime',
	'decimal',
	'float',
	'integer',
	'json',
	'string',
	'text',
	'time',
	'timestamp',
	'binary',
	'uuid',
	'alias',
	'hash',
	'csv',
	'geometry',
	'geometry.Point',
	'geometry.LineString',
	'geometry.Polygon',
	'geometry.MultiPoint',
	'geometry.MultiLineString',
	'geometry.MultiPolygon',
	'unknown',
] as const;

const LOCAL_TYPES = [
	'standard',
	'file',
	'files',
	'm2o',
	'o2m',
	'm2m',
	'm2a',
	'presentation',
	'translations',
	'group',
] as const;

export default defineDisplay({
	id: 'raw',
	name: '$t:displays.raw.raw',
	icon: 'code',
	component: ({ value }: { value: unknown }) => (typeof value === 'string' ? value : JSON.stringify(value)),
	options: [],
	types: TYPES,
	localTypes: LOCAL_TYPES,
});
