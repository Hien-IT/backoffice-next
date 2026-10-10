// Ported from directus/packages/types/src/events.ts (subset: EventContext, used by ActionEventParams; events are not emitted, D-26 of spec 003)
import type { Knex } from 'knex';
import type { Accountability } from './accountability.js';
import type { SchemaOverview } from './schema.js';

export type EventContext = {
	database: Knex;
	schema: SchemaOverview | null;
	accountability: Accountability | null;
};
