// Ported from directus/api/src/database/helpers/number/dialects/sqlite.ts
import type { NumericValue } from '@backoffice/types';
import type { Knex } from 'knex';
import { NumberDatabaseHelper } from '../types.js';
import { maybeStringifyBigInt } from '../utils/maybe-stringify-big-int.js';

export class NumberHelperSQLite extends NumberDatabaseHelper {
	override addSearchCondition(
		dbQuery: Knex.QueryBuilder,
		collection: string,
		name: string,
		value: NumericValue,
		logical: 'and' | 'or',
	): Knex.QueryBuilder {
		return dbQuery[logical].where({ [`${collection}.${name}`]: maybeStringifyBigInt(value) });
	}
}
