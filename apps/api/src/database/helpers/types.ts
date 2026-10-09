// Ported from directus/api/src/database/helpers/types.ts
import type { Knex } from 'knex';

export abstract class DatabaseHelper {
	constructor(protected knex: Knex) {}
}
