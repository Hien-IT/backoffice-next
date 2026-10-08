// Ported from directus/packages/types/src/services.ts (subset: AbstractServiceOptions only; the service interfaces come with the features that port each service)
import type { Knex } from 'knex';
import type { Accountability } from './accountability.js';
import type { SchemaOverview } from './schema.js';

export type AbstractServiceOptions = {
	knex?: Knex | undefined;
	accountability?: Accountability | null | undefined;
	schema: SchemaOverview;
	nested?: string[];
};
