// Ported from directus/api/src/database/helpers/sequence/types.ts
import type { Knex } from 'knex';
import { DatabaseHelper } from '../types.js';

export class AutoSequenceHelper extends DatabaseHelper {
	async resetAutoIncrementSequence(_table: string, _column: string): Promise<Knex.Raw | void> {
		return;
	}
}
