// Ported from directus/api/src/database/helpers/index.ts (date, geometry and the formatUUID part of schema; the
// fn, number, sequence and capabilities helpers come with the features that use them)
import type { Knex } from 'knex';
import { getDatabaseClient } from '../index.js';
import * as dateHelpers from './date/index.js';
import * as geometryHelpers from './geometry/index.js';
import * as schemaHelpers from './schema/index.js';

export function getHelpers(database: Knex) {
	const client = getDatabaseClient(database);

	return {
		date: new dateHelpers[client](database),
		st: new geometryHelpers[client](database),
		schema: new schemaHelpers[client](database),
	};
}

export type Helpers = ReturnType<typeof getHelpers>;
