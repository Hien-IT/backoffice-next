// Ported from directus/api/src/database/helpers/index.ts (geometry helper only)
import type { Knex } from 'knex';
import { getDatabaseClient } from '../index.js';
import * as geometryHelpers from './geometry/index.js';

export function getHelpers(database: Knex) {
	const client = getDatabaseClient(database);

	return {
		st: new geometryHelpers[client](database),
	};
}
